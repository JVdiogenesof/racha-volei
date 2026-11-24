-- Níveis de acesso dos organizadores.
--   full       -> tudo (padrão; JV, Vidal, Telma, Juliana...)
--   lists      -> só listas de racha, times e confrontos
--   lists_arts -> listas + geração de artes
-- Aditivo e compatível com a versão publicada: todo mundo continua 'full'.
alter table public.profiles
  add column if not exists organizer_scope text not null default 'full';

alter table public.profiles
  drop constraint if exists profiles_organizer_scope_check;
alter table public.profiles
  add constraint profiles_organizer_scope_check check (organizer_scope in ('full', 'lists', 'lists_arts'));

create or replace function public.is_full_organizer()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select is_organizer and organizer_scope = 'full' from profiles where id = auth.uid()), false);
$$;

revoke execute on function public.is_full_organizer() from public;
grant execute on function public.is_full_organizer() to authenticated;

-- Só organizador completo muda nível/permissão (antes: qualquer organizador).
create or replace function public.guard_profile_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.organizer_scope is distinct from old.organizer_scope)
     and auth.uid() is not null
     and not public.is_full_organizer() then
    raise exception 'Somente organizadores completos podem alterar o nível de acesso.';
  end if;
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

-- Áreas administrativas sensíveis passam a exigir organizador completo no banco
-- (além da checagem no app): notas, ajuste de ranking, lista de reserva, finanças.
alter policy "organizer_ratings_insert" on public.organizer_ratings
  with check (public.is_full_organizer() and rated_by = (select auth.uid()));
alter policy "organizer_ratings_update" on public.organizer_ratings
  using (public.is_full_organizer())
  with check (public.is_full_organizer() and rated_by = (select auth.uid()));
alter policy "organizer_ratings_delete" on public.organizer_ratings
  using (public.is_full_organizer());

alter policy "rating_weights_insert" on public.rating_weights
  with check (public.is_full_organizer());
alter policy "rating_weights_update" on public.rating_weights
  using (public.is_full_organizer())
  with check (public.is_full_organizer());
alter policy "rating_weights_delete" on public.rating_weights
  using (public.is_full_organizer());

alter policy "ranking_adjustments_insert" on public.ranking_adjustments
  with check (public.is_full_organizer() and created_by = (select auth.uid()));
alter policy "ranking_adjustments_delete" on public.ranking_adjustments
  using (public.is_full_organizer());

-- reserve_list_select continua liberada a todo organizador: a tela de lista do
-- racha usa os nomes da reserva pra incluir gente na lista.
alter policy "reserve_list_update" on public.reserve_list
  using (auth_user_id = (select auth.uid()) or public.is_full_organizer())
  with check (auth_user_id = (select auth.uid()) or public.is_full_organizer());
alter policy "reserve_list_delete" on public.reserve_list
  using (public.is_full_organizer());

alter policy "finance_transactions_select_organizer" on public.finance_transactions
  using ((select public.is_full_organizer()));
alter policy "finance_transactions_insert_organizer" on public.finance_transactions
  with check ((select public.is_full_organizer()) and created_by = (select auth.uid()));
alter policy "finance_transactions_update_organizer" on public.finance_transactions
  using ((select public.is_full_organizer()))
  with check ((select public.is_full_organizer()));

alter policy "finance_reminders_organizer_all" on public.finance_reminders
  using ((select public.is_full_organizer()))
  with check ((select public.is_full_organizer()));
