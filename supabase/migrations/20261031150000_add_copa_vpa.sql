-- Copa VPA: competição curta disputada pelos campeões de rachas
-- classificatórios. Cada classificatória rende uma vaga por membro do time
-- campeão; quem já estava classificado e vence de novo repassa a vaga ao
-- próximo do Índice VPA (com prioridade para levantadores). A lógica de
-- classificação fica no app (precisa do Índice VPA calculado em TypeScript);
-- o banco só guarda o resultado e restringe a escrita aos organizadores.

create table public.cups (
  id uuid primary key default gen_random_uuid(),
  community text not null default 'court' check (community in ('court', 'sand')),
  name text not null check (char_length(trim(name)) between 1 and 80),
  final_date date not null,
  -- Datas planejadas das classificatórias: um racha criado numa delas entra
  -- sozinho como classificatório desta copa.
  qualifier_dates date[] not null default '{}',
  num_teams integer not null default 4 check (num_teams between 2 and 8),
  team_size integer not null default 6 check (team_size between 2 and 12),
  final_event_id uuid references public.events(id) on delete set null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create index cups_community_final_date_idx on public.cups (community, final_date desc);
create index cups_final_event_idx on public.cups (final_event_id);
create index cups_created_by_idx on public.cups (created_by);

create table public.cup_qualifiers (
  id uuid primary key default gen_random_uuid(),
  cup_id uuid not null references public.cups(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  created_at timestamptz not null default now(),
  -- Um racha classifica para uma única copa.
  unique (event_id)
);

create index cup_qualifiers_cup_idx on public.cup_qualifiers (cup_id);

create table public.cup_qualified_players (
  id uuid primary key default gen_random_uuid(),
  cup_id uuid not null references public.cups(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  source text not null check (source in ('champion', 'ranking', 'manual')),
  source_event_id uuid references public.events(id) on delete set null,
  -- Vaga do ranking: quem venceu de novo e liberou esta vaga.
  replaces_profile_id uuid references public.profiles(id) on delete set null,
  ranking_position integer check (ranking_position is null or ranking_position > 0),
  added_by uuid not null references public.profiles(id),
  added_at timestamptz not null default now(),
  unique (cup_id, profile_id)
);

create index cup_qualified_players_profile_idx on public.cup_qualified_players (profile_id);
create index cup_qualified_players_source_event_idx on public.cup_qualified_players (source_event_id);
create index cup_qualified_players_replaces_idx on public.cup_qualified_players (replaces_profile_id);
create index cup_qualified_players_added_by_idx on public.cup_qualified_players (added_by);

alter table public.cups enable row level security;
alter table public.cup_qualifiers enable row level security;
alter table public.cup_qualified_players enable row level security;

-- Os privilégios padrão do projeto dão tudo (inclusive TRUNCATE, que o RLS
-- não cobre) direto a anon/authenticated: deixa só o que o app usa.
revoke all on table public.cups, public.cup_qualifiers, public.cup_qualified_players from anon, authenticated;
grant select, insert, update, delete on table public.cups, public.cup_qualifiers, public.cup_qualified_players to authenticated;

-- Leitura aberta a quem está logado: a página da copa é uma vitrine.
create policy "cups_select" on public.cups for select to authenticated using (true);
create policy "cups_insert_organizer" on public.cups for insert to authenticated
  with check ((select public.is_organizer()) and created_by = (select auth.uid()));
create policy "cups_update_organizer" on public.cups for update to authenticated
  using ((select public.is_organizer())) with check ((select public.is_organizer()));
create policy "cups_delete_organizer" on public.cups for delete to authenticated
  using ((select public.is_organizer()));

create policy "cup_qualifiers_select" on public.cup_qualifiers for select to authenticated using (true);
create policy "cup_qualifiers_insert_organizer" on public.cup_qualifiers for insert to authenticated
  with check ((select public.is_organizer()));
create policy "cup_qualifiers_delete_organizer" on public.cup_qualifiers for delete to authenticated
  using ((select public.is_organizer()));

create policy "cup_qualified_players_select" on public.cup_qualified_players for select to authenticated using (true);
create policy "cup_qualified_players_insert_organizer" on public.cup_qualified_players for insert to authenticated
  with check ((select public.is_organizer()) and added_by = (select auth.uid()));
create policy "cup_qualified_players_delete_organizer" on public.cup_qualified_players for delete to authenticated
  using ((select public.is_organizer()));

-- Copa VPA de novembro/2026: final em 29/11 com 4 times, classificatórias nos
-- domingos 01, 08, 15 e 22/11. O racha de 01/11 já existe e entra agora.
insert into public.cups (community, name, final_date, qualifier_dates, num_teams, team_size, created_by)
select 'court', 'Copa VPA', date '2026-11-29',
  array[date '2026-11-01', date '2026-11-08', date '2026-11-15', date '2026-11-22'], 4, 6, p.id
from public.profiles p
where p.id = 'ea6c4b3a-a774-4ccd-a705-c14220193812';

insert into public.cup_qualifiers (cup_id, event_id)
select c.id, e.id
from public.cups c
join public.events e on e.community = c.community and e.date = any(c.qualifier_dates) and e.status <> 'cancelled'
where c.name = 'Copa VPA' and c.final_date = date '2026-11-29'
on conflict (event_id) do nothing;
