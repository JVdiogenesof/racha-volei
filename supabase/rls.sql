-- Políticas de segurança (Row Level Security) do site de racha.
-- Rode este arquivo inteiro uma vez no SQL Editor do Supabase, DEPOIS de aplicar
-- o schema do Drizzle (npm run db:push). Não é gerenciado pelo Drizzle porque
-- depende de auth.uid(), auth.users e de funções específicas do Postgres/Supabase.

-- Liga profiles.id ao usuário real do Supabase Auth: apagar o usuário apaga o perfil junto.
alter table profiles
  add constraint profiles_id_auth_users_id_fk
  foreign key (id) references auth.users (id) on delete cascade;

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
     and not public.is_organizer() then
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
  select coalesce((select status = 'approved' from profiles where id = auth.uid()), false);
$$;

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

-- profiles: sempre pode ver a própria linha; só vê as demais se já for aprovado.
create policy "profiles_select" on profiles for select to authenticated
  using (id = auth.uid() or public.is_approved());

-- cadastro inicial: só a própria linha, sempre como pending/não-organizador.
create policy "profiles_insert_self" on profiles for insert to authenticated
  with check (id = auth.uid() and status = 'pending' and is_organizer = false and approved_by is null);

-- edição: a própria pessoa (campos privilegiados são bloqueados pelo trigger acima)
-- ou qualquer organizador editando qualquer perfil.
create policy "profiles_update" on profiles for update to authenticated
  using (id = auth.uid() or public.is_organizer())
  with check (id = auth.uid() or public.is_organizer());

-- self_ratings: transparência total pra leitura; só o próprio dono escreve.
create policy "self_ratings_select" on self_ratings for select to authenticated using (true);
create policy "self_ratings_write" on self_ratings for all to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

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
create policy "events_select" on events for select to authenticated using (true);
create policy "events_write" on events for all to authenticated
  using (public.is_organizer())
  with check (public.is_organizer() and created_by = auth.uid());

-- attendance: todo mundo lê (lista de confirmados é pública pro grupo);
-- cada um confirma/desmarca a própria presença; organizador pode mexer em qualquer uma.
create policy "attendance_select" on attendance for select to authenticated using (true);
create policy "attendance_write" on attendance for all to authenticated
  using (profile_id = auth.uid() or public.is_organizer())
  with check (profile_id = auth.uid() or public.is_organizer());

-- payments: leitura aberta ao grupo; só organizador marca pagamento.
create policy "payments_select" on payments for select to authenticated using (true);
create policy "payments_write" on payments for all to authenticated
  using (public.is_organizer())
  with check (public.is_organizer());

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
  with check (voter_profile_id = auth.uid());

-- Storage: bucket "avisos" (crie manualmente no painel Supabase > Storage,
-- marcado como "Public bucket" antes de rodar isto). Leitura pública (fotos
-- dos avisos), só organizador publica.
create policy "avisos_bucket_read" on storage.objects for select
  using (bucket_id = 'avisos');

create policy "avisos_bucket_write" on storage.objects for insert to authenticated
  with check (bucket_id = 'avisos' and public.is_organizer());
