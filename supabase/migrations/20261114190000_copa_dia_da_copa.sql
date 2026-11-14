-- Dia da Copa VPA: times, sorteio ao vivo e jogos, tudo dentro de Torneios › Copa
-- (sem criar racha). Migração aditiva: não altera nenhuma tabela usada hoje.
--
-- O sorteio é calculado no servidor e gravado de uma vez em cup_team_members,
-- mas cada escolha só fica visível para todos (revealed_at) quando o
-- organizador a revela. Assim a plateia acompanha ao vivo e ninguém descobre
-- o resultado antes consultando o banco.

alter table public.cups
  add column if not exists day_start time not null default '09:00',
  add column if not exists match_minutes integer not null default 30 check (match_minutes between 10 and 120),
  add column if not exists game_points integer not null default 15 check (game_points between 5 and 50);

create table if not exists public.cup_teams (
  id uuid primary key default gen_random_uuid(),
  cup_id uuid not null references public.cups(id) on delete cascade,
  -- Identidade visual fixa no app (nome, cores e logo por slug).
  slug text not null check (char_length(slug) between 1 and 40),
  name text not null check (char_length(trim(name)) between 1 and 40),
  position integer not null check (position > 0),
  created_at timestamptz not null default now(),
  unique (cup_id, slug),
  unique (cup_id, position)
);

create table if not exists public.cup_team_members (
  id uuid primary key default gen_random_uuid(),
  cup_id uuid not null references public.cups(id) on delete cascade,
  team_id uuid not null references public.cup_teams(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  -- Pote de onde o jogador saiu (0 = levantadores) e ordem em que é revelado.
  pot integer not null check (pot >= 0),
  pick_order integer not null check (pick_order > 0),
  revealed_at timestamptz,
  unique (cup_id, profile_id),
  unique (cup_id, pick_order)
);

create index if not exists cup_teams_cup_idx on public.cup_teams (cup_id);
create index if not exists cup_team_members_team_idx on public.cup_team_members (team_id);
create index if not exists cup_team_members_profile_idx on public.cup_team_members (profile_id);

create table if not exists public.cup_matches (
  id uuid primary key default gen_random_uuid(),
  cup_id uuid not null references public.cups(id) on delete cascade,
  stage text not null check (stage in ('group', 'bronze', 'final')),
  round integer not null check (round > 0),
  slot integer not null check (slot > 0),
  team_a_id uuid not null references public.cup_teams(id) on delete cascade,
  team_b_id uuid not null references public.cup_teams(id) on delete cascade,
  score_a integer check (score_a is null or score_a >= 0),
  score_b integer check (score_b is null or score_b >= 0),
  scheduled_at timestamptz,
  created_at timestamptz not null default now(),
  check (team_a_id <> team_b_id),
  unique (cup_id, slot)
);

create index if not exists cup_matches_cup_idx on public.cup_matches (cup_id);
create index if not exists cup_matches_team_a_idx on public.cup_matches (team_a_id);
create index if not exists cup_matches_team_b_idx on public.cup_matches (team_b_id);

alter table public.cup_teams enable row level security;
alter table public.cup_team_members enable row level security;
alter table public.cup_matches enable row level security;

revoke all on table public.cup_teams, public.cup_team_members, public.cup_matches from anon, authenticated;
grant select, insert, update, delete on table public.cup_teams, public.cup_team_members, public.cup_matches to authenticated;

drop policy if exists "cup_teams_select" on public.cup_teams;
create policy "cup_teams_select" on public.cup_teams for select to authenticated using (true);
drop policy if exists "cup_teams_write_organizer" on public.cup_teams;
create policy "cup_teams_write_organizer" on public.cup_teams for all to authenticated
  using ((select public.is_organizer())) with check ((select public.is_organizer()));

-- Escolhas ainda não reveladas só o organizador enxerga.
drop policy if exists "cup_team_members_select" on public.cup_team_members;
create policy "cup_team_members_select" on public.cup_team_members for select to authenticated
  using (revealed_at is not null or (select public.is_organizer()));
drop policy if exists "cup_team_members_write_organizer" on public.cup_team_members;
create policy "cup_team_members_write_organizer" on public.cup_team_members for all to authenticated
  using ((select public.is_organizer())) with check ((select public.is_organizer()));

drop policy if exists "cup_matches_select" on public.cup_matches;
create policy "cup_matches_select" on public.cup_matches for select to authenticated using (true);
drop policy if exists "cup_matches_write_organizer" on public.cup_matches;
create policy "cup_matches_write_organizer" on public.cup_matches for all to authenticated
  using ((select public.is_organizer())) with check ((select public.is_organizer()));
