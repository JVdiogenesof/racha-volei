alter table public.match_wins
  add column if not exists loser_team_id uuid,
  add column if not exists winning_profile_ids uuid[],
  add column if not exists losing_profile_ids uuid[];

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'match_wins_loser_team_id_fkey') then
    alter table public.match_wins
      add constraint match_wins_loser_team_id_fkey
      foreign key (loser_team_id) references public.teams(id) on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'match_wins_different_teams_check') then
    alter table public.match_wins
      add constraint match_wins_different_teams_check
      check (loser_team_id is null or loser_team_id <> team_id);
  end if;
end
$$;

create index if not exists match_wins_loser_team_id_idx
  on public.match_wins(loser_team_id)
  where loser_team_id is not null;

create index if not exists match_wins_event_id_idx on public.match_wins(event_id);
create index if not exists match_wins_team_id_idx on public.match_wins(team_id);
create index if not exists match_wins_match_id_idx
  on public.match_wins(match_id)
  where match_id is not null;
create index if not exists match_wins_recorded_by_idx on public.match_wins(recorded_by);

drop policy if exists "match_wins_insert" on public.match_wins;
create policy "match_wins_insert" on public.match_wins for insert to authenticated
  with check ((select public.is_organizer()) and recorded_by = (select auth.uid()));

drop policy if exists "match_wins_delete" on public.match_wins;
create policy "match_wins_delete" on public.match_wins for delete to authenticated
  using ((select public.is_organizer()));
