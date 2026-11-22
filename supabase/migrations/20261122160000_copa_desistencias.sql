-- Quem não vai jogar a Copa (desistiu ou não compareceu): fica fora das vagas
-- de campeão e da fila do ranking, para a vaga não voltar sozinha quando a
-- distribuição for refeita. Migração aditiva.
create table if not exists public.cup_excluded_players (
  id uuid primary key default gen_random_uuid(),
  cup_id uuid not null references public.cups(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  reason text,
  added_by uuid not null references public.profiles(id),
  added_at timestamptz not null default now(),
  unique (cup_id, profile_id)
);

create index if not exists cup_excluded_players_profile_idx on public.cup_excluded_players (profile_id);
create index if not exists cup_excluded_players_added_by_idx on public.cup_excluded_players (added_by);

alter table public.cup_excluded_players enable row level security;

revoke all on table public.cup_excluded_players from anon, authenticated;
grant select, insert, update, delete on table public.cup_excluded_players to authenticated;

drop policy if exists "cup_excluded_players_select" on public.cup_excluded_players;
create policy "cup_excluded_players_select" on public.cup_excluded_players for select to authenticated using (true);
drop policy if exists "cup_excluded_players_insert_organizer" on public.cup_excluded_players;
create policy "cup_excluded_players_insert_organizer" on public.cup_excluded_players for insert to authenticated
  with check ((select public.is_organizer()) and added_by = (select auth.uid()));
drop policy if exists "cup_excluded_players_delete_organizer" on public.cup_excluded_players;
create policy "cup_excluded_players_delete_organizer" on public.cup_excluded_players for delete to authenticated
  using ((select public.is_organizer()));
