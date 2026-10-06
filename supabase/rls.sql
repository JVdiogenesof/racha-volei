-- Políticas de segurança (Row Level Security) do site de racha.
-- Rode este arquivo inteiro uma vez no SQL Editor do Supabase, DEPOIS de aplicar
-- o schema do Drizzle (npm run db:push). Não é gerenciado pelo Drizzle porque
-- depende de auth.uid(), auth.users e de funções específicas do Postgres/Supabase.

-- Liga profiles.id ao usuário real do Supabase Auth: apagar o usuário apaga o perfil junto.
alter table profiles
  add constraint profiles_id_auth_users_id_fk
  foreign key (id) references auth.users (id) on delete cascade;

-- Mesma coisa pra lista de reserva (gente de fora do grupo).
alter table reserve_list
  add constraint reserve_list_auth_user_id_fk
  foreign key (auth_user_id) references auth.users (id) on delete cascade;

-- O perfil continua como visitante quando o racha do convite é apagado.
alter table profiles
  add constraint profiles_guest_for_event_id_fk
  foreign key (guest_for_event_id) references events (id) on delete set null;

-- Função auxiliar: true se o usuário logado é organizador.
-- SECURITY DEFINER + search_path fixo evita recursão de RLS ao consultar "profiles"
-- e evita que a função seja sequestrada por um search_path malicioso.
create or replace function public.is_organizer()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select is_organizer from profiles where id = auth.uid()), false);
$$;

-- Trigger: impede que alguém sem ser organizador altere os próprios campos
-- privilegiados (status de aprovação, flag de organizador, quem aprovou).
create or replace function public.guard_profile_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- auth.uid() is null fora do contexto de uma requisição autenticada via API
  -- (ex: SQL Editor, script administrativo) — esses acessos já exigem
  -- credenciais de banco e são confiáveis por definição. Só bloqueamos quando
  -- é um usuário comum autenticado tentando se autopromover.
  if (new.status is distinct from old.status
      or new.is_organizer is distinct from old.is_organizer
      or new.approved_by is distinct from old.approved_by)
     and auth.uid() is not null
     and not public.is_organizer()
     and not (
       old.id = auth.uid()
       and old.status = 'guest'
       and new.status = 'visitor'
       and new.guest_for_event_id is null
       and new.approved_by is null
       and new.is_organizer = old.is_organizer
     ) then
    raise exception 'Somente organizadores podem alterar status/aprovação/permissão de organizador.';
  end if;
  return new;
end;
$$;

-- Função auxiliar: true se o usuário logado já está aprovado.
-- Mesmo motivo do is_organizer() acima: evita recursão de RLS ao consultar
-- "profiles" de dentro da própria política de select de "profiles".
create or replace function public.is_approved()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  -- visitor enxerga o app em modo vitrine; guest também enxerga tudo,
  -- mas as políticas de escrita só liberam o racha para o qual foi chamado.
  select coalesce((select status in ('approved', 'guest', 'visitor') from profiles where id = auth.uid()), false);
$$;

create or replace function public.is_full_member()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select status = 'approved' from profiles where id = auth.uid()), false);
$$;

create or replace function public.can_edit_own_profile()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select status = 'approved' from profiles where id = auth.uid()), false);
$$;

create or replace function public.can_participate_in_event(target_event_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((
    select
      (p.status = 'approved' and e.community = any(p.communities))
      or (p.status = 'guest' and p.guest_for_event_id = e.id)
    from profiles p
    join events e on e.id = target_event_id
    where p.id = auth.uid()
  ), false);
$$;

create or replace function public.expire_my_guest_access()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update profiles p
  set status = 'visitor', guest_for_event_id = null, approved_by = null
  where p.id = auth.uid() and p.status = 'guest'
    and not exists (
      select 1 from events e where e.id = p.guest_for_event_id
        and e.status not in ('finished', 'cancelled')
    );
end;
$$;

grant execute on function public.expire_my_guest_access() to authenticated;

drop trigger if exists trg_guard_profile_privileged_columns on profiles;
create trigger trg_guard_profile_privileged_columns
  before update on profiles
  for each row execute function public.guard_profile_privileged_columns();

alter table profiles enable row level security;
alter table self_ratings enable row level security;
alter table organizer_ratings enable row level security;
alter table rating_weights enable row level security;
alter table events enable row level security;
alter table attendance enable row level security;
alter table payments enable row level security;
alter table team_generations enable row level security;
alter table teams enable row level security;
alter table team_members enable row level security;
alter table announcements enable row level security;
alter table mvp_votes enable row level security;
alter table match_wins enable row level security;
alter table ranking_adjustments enable row level security;
alter table reserve_list enable row level security;
alter table push_subscriptions enable row level security;
alter table tournament_reserved_players enable row level security;
alter table tournament_matches enable row level security;
alter table shirt_orders enable row level security;
alter table free_racha_credits enable row level security;

-- profiles: sempre pode ver a própria linha; só vê as demais se já for aprovado.
create policy "profiles_select" on profiles for select to authenticated
  using (id = auth.uid() or public.is_approved());

create policy "profiles_insert_visitor_self" on profiles for insert to authenticated
  with check (id = auth.uid() and status = 'visitor' and is_organizer = false and approved_by is null and guest_for_event_id is null);

-- organizador cria um perfil "guest" pra alguém de fora que ele chamou da
-- lista de reserva pra jogar um racha específico.
create policy "profiles_insert_guest_by_organizer" on profiles for insert to authenticated
  with check (public.is_organizer() and status = 'guest');

-- edição: a própria pessoa (campos privilegiados são bloqueados pelo trigger acima)
-- ou qualquer organizador editando qualquer perfil.
create policy "profiles_update" on profiles for update to authenticated
  using (public.is_organizer() or (id = auth.uid() and public.can_edit_own_profile()))
  with check (public.is_organizer() or (id = auth.uid() and public.can_edit_own_profile()));

-- apagar perfil só é permitido pra "guest" (acesso expirado se apaga sozinho,
-- ou organizador encerra na mão) -- nunca apaga membro de verdade por aqui.
create policy "profiles_delete_guest" on profiles for delete to authenticated
  using (status = 'guest' and (id = auth.uid() or public.is_organizer()));

-- self_ratings: transparência total pra leitura; só o próprio dono escreve.
create policy "self_ratings_select" on self_ratings for select to authenticated using (true);
create policy "self_ratings_write" on self_ratings for all to authenticated
  using ((profile_id = auth.uid() and public.can_edit_own_profile()) or public.is_organizer())
  with check ((profile_id = auth.uid() and public.can_edit_own_profile()) or public.is_organizer());

-- organizer_ratings: transparência total pra leitura; só organizador escreve.
create policy "organizer_ratings_select" on organizer_ratings for select to authenticated using (true);
create policy "organizer_ratings_write" on organizer_ratings for all to authenticated
  using (public.is_organizer())
  with check (public.is_organizer() and rated_by = auth.uid());

-- rating_weights: todo mundo lê, só organizador ajusta.
create policy "rating_weights_select" on rating_weights for select to authenticated using (true);
create policy "rating_weights_write" on rating_weights for all to authenticated
  using (public.is_organizer())
  with check (public.is_organizer());

-- events: todo mundo lê, só organizador cria/edita/apaga.
-- Separado em 3 políticas (em vez de "for all") porque o WITH CHECK de uma
-- policy "for all" também vale pro UPDATE — se exigíssemos created_by = auth.uid()
-- ali, um organizador não conseguiria editar/apagar um racha criado por outro.
create policy "events_select" on events for select to authenticated using (true);

create policy "events_insert" on events for insert to authenticated
  with check (public.is_organizer() and created_by = auth.uid());

create policy "events_update" on events for update to authenticated
  using (public.is_organizer())
  with check (public.is_organizer());

create policy "events_delete" on events for delete to authenticated
  using (public.is_organizer());

-- attendance: todo mundo lê (lista de confirmados é pública pro grupo);
-- cada um confirma/desmarca a própria presença; organizador pode mexer em qualquer uma.
create policy "attendance_select" on attendance for select to authenticated using (true);
create policy "attendance_write" on attendance for all to authenticated
  using (public.is_organizer() or (profile_id = auth.uid() and public.can_participate_in_event(event_id)))
  with check (public.is_organizer() or (profile_id = auth.uid() and public.can_participate_in_event(event_id)));

-- A função de levantador pode ser ajustada por racha sem alterar o perfil.
-- Todos veem a escalação, mas só organizadores podem mudá-la.
alter table event_setter_overrides enable row level security;
create policy "event_setter_overrides_select" on event_setter_overrides for select to authenticated using (true);
create policy "event_setter_overrides_write" on event_setter_overrides for all to authenticated
  using (public.is_organizer())
  with check (public.is_organizer() and changed_by = (select auth.uid()));

-- payments: leitura aberta ao grupo; só organizador marca pagamento.
create policy "payments_select" on payments for select to authenticated using (true);
create policy "payments_write" on payments for all to authenticated
  using (public.is_organizer())
  with check (public.is_organizer());

-- Créditos de racha gratuito contêm controle financeiro interno. Somente
-- organizadores podem consultar ou alterar, inclusive pela Data API.
create policy "free_racha_credits_select_organizer" on free_racha_credits for select to authenticated
  using ((select public.is_organizer()));
create policy "free_racha_credits_insert_organizer" on free_racha_credits for insert to authenticated
  with check ((select public.is_organizer()) and granted_by = (select auth.uid()));
create policy "free_racha_credits_update_organizer" on free_racha_credits for update to authenticated
  using ((select public.is_organizer()))
  with check ((select public.is_organizer()));

-- times gerados: leitura aberta; só organizador gera/edita.
create policy "team_generations_select" on team_generations for select to authenticated using (true);
create policy "team_generations_write" on team_generations for all to authenticated
  using (public.is_organizer())
  with check (public.is_organizer() and generated_by = auth.uid());

create policy "teams_select" on teams for select to authenticated using (true);
create policy "teams_write" on teams for all to authenticated
  using (public.is_organizer())
  with check (public.is_organizer());

create policy "team_members_select" on team_members for select to authenticated using (true);
create policy "team_members_write" on team_members for all to authenticated
  using (public.is_organizer())
  with check (public.is_organizer());

-- avisos: mural aberto pra leitura; só organizador publica.
create policy "announcements_select" on announcements for select to authenticated using (true);
create policy "announcements_write" on announcements for all to authenticated
  using (public.is_organizer())
  with check (public.is_organizer() and created_by = auth.uid());

-- mvp_votes: leitura aberta (pra calcular o resultado); cada um só registra o próprio
-- voto (não pode editar/apagar depois de votado, evita "cabo eleitoral" mudando de ideia
-- só pra favorecer alguém após ver o placar parcial).
create policy "mvp_votes_select" on mvp_votes for select to authenticated using (true);
create policy "mvp_votes_insert" on mvp_votes for insert to authenticated
  with check (voter_profile_id = auth.uid() and public.can_participate_in_event(event_id));

-- match_wins: leitura aberta (alimenta o ranking de vitórias); só organizador registra/apaga.
create policy "match_wins_select" on match_wins for select to authenticated using (true);
create policy "match_wins_insert" on match_wins for insert to authenticated
  with check ((select public.is_organizer()) and recorded_by = (select auth.uid()));
create policy "match_wins_delete" on match_wins for delete to authenticated
  using ((select public.is_organizer()));

-- ranking_adjustments: leitura aberta (soma no cálculo do ranking pra todo mundo);
-- só organizador cria/apaga ajuste manual.
create policy "ranking_adjustments_select" on ranking_adjustments for select to authenticated using (true);
create policy "ranking_adjustments_insert" on ranking_adjustments for insert to authenticated
  with check (public.is_organizer() and created_by = auth.uid());
create policy "ranking_adjustments_delete" on ranking_adjustments for delete to authenticated
  using (public.is_organizer());

-- reserve_list: cada um só vê/edita a própria linha; organizador vê e mexe em todas
-- (precisa ver o telefone de todo mundo pra poder chamar quando sobrar vaga).
create policy "reserve_list_select" on reserve_list for select to authenticated
  using (auth_user_id = auth.uid() or public.is_organizer());
create policy "reserve_list_insert" on reserve_list for insert to authenticated
  with check (auth_user_id = auth.uid());
create policy "reserve_list_update" on reserve_list for update to authenticated
  using (auth_user_id = auth.uid() or public.is_organizer())
  with check (auth_user_id = auth.uid() or public.is_organizer());
create policy "reserve_list_delete" on reserve_list for delete to authenticated
  using (public.is_organizer());

-- push_subscriptions: leitura aberta (mesmo padrão de attendance/events/etc) --
-- é o que permite, por exemplo, uma pessoa recém-cadastrada (ainda não
-- organizadora) disparar o aviso de "novo cadastro pendente" pros
-- organizadores. Só dono ou organizador cria/apaga uma inscrição.
create policy "push_subscriptions_select" on push_subscriptions for select to authenticated using (true);
create policy "push_subscriptions_insert" on push_subscriptions for insert to authenticated
  with check (profile_id = auth.uid() and public.is_full_member());
create policy "push_subscriptions_delete" on push_subscriptions for delete to authenticated
  using ((profile_id = auth.uid() and public.is_full_member()) or public.is_organizer());

-- tournament_reserved_players: leitura aberta (vira uma vitrine pública de
-- quem já garantiu vaga no torneio); só organizador insere/apaga (finalizar
-- um racha pré-torneio insere via SECURITY DEFINER da própria service role
-- da action, que já roda como o organizador autenticado).
create policy "tournament_reserved_players_select" on tournament_reserved_players for select to authenticated using (true);
create policy "tournament_reserved_players_insert" on tournament_reserved_players for insert to authenticated
  with check (public.is_organizer() and added_by = auth.uid());
create policy "tournament_reserved_players_delete" on tournament_reserved_players for delete to authenticated
  using (public.is_organizer());

-- tournament_matches: confrontos da fase de grupos/final de um racha
-- pré-torneio -- leitura aberta (alimenta a classificação pra todo mundo);
-- só organizador lança/edita/apaga placar.
create policy "tournament_matches_select" on tournament_matches for select to authenticated using (true);
create policy "tournament_matches_write" on tournament_matches for all to authenticated
  using (public.is_organizer())
  with check (public.is_organizer());

-- Pedidos das camisas: cada membro vê e altera o próprio pedido enquanto ele
-- está pendente. Organizadores veem tudo e são os únicos que marcam pagamento.
-- Ownership stays enforced by RLS. This invoker trigger limits what owners
-- can edit after paying and prevents self-confirming any payment.
create or replace function public.guard_shirt_order_changes()
returns trigger language plpgsql security invoker set search_path = '' as $
begin
  if auth.uid() is not null and not public.is_organizer() then
    if (to_jsonb(new) - array['fit','updated_at']) is distinct from
       (to_jsonb(old) - array['fit','updated_at']) and (old.paid or old.half_paid) then
      raise exception 'Pedido com pagamento: somente a modelagem pode ser alterada.';
    end if;
    if row(new.id,new.profile_id,new.community,new.model,new.paid,new.half_paid,new.paid_at,new.marked_by,new.created_at)
      is distinct from row(old.id,old.profile_id,old.community,old.model,old.paid,old.half_paid,old.paid_at,old.marked_by,old.created_at) then
      raise exception 'Somente organizadores podem alterar pagamentos ou a identificação do pedido.';
    end if;
  end if;
  return new;
end;
$;
drop trigger if exists guard_shirt_order_changes on public.shirt_orders;
create trigger guard_shirt_order_changes before update on public.shirt_orders
  for each row execute function public.guard_shirt_order_changes();
revoke all on function public.guard_shirt_order_changes() from public;

create policy "shirt_orders_select" on shirt_orders for select to authenticated
  using (profile_id = auth.uid() or public.is_organizer());
create policy "shirt_orders_insert_own" on shirt_orders for insert to authenticated
  with check (profile_id = auth.uid() and public.is_full_member()
    and not paid and not half_paid and paid_at is null and marked_by is null);
create policy "shirt_orders_update_own_or_organizer" on shirt_orders for update to authenticated
  using (public.is_organizer() or (profile_id = auth.uid() and public.is_full_member()))
  with check (public.is_organizer() or (profile_id = auth.uid() and public.is_full_member()));
create policy "shirt_orders_delete_own_or_organizer" on shirt_orders for delete to authenticated
  using (public.is_organizer() or (profile_id = auth.uid() and public.is_full_member() and not paid and not half_paid));


-- Storage: bucket "avisos" (crie manualmente no painel Supabase > Storage,
-- marcado como "Public bucket" antes de rodar isto). Leitura pública (fotos
-- dos avisos), só organizador publica.
create policy "avisos_bucket_read" on storage.objects for select
  using (bucket_id = 'avisos');

create policy "avisos_bucket_write" on storage.objects for insert to authenticated
  with check (bucket_id = 'avisos' and public.is_organizer());
