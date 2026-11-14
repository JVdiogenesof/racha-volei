-- Personalização de perfil (banner, efeito, medalhas em destaque) e vitrine de
-- medalhas/troféus de eventos. Aditiva: nada do que existe muda.
--
--  * profiles.profile_banner / profile_effect: ids do catálogo em src/lib/cosmetics.ts.
--    A validação (o item está liberado?) é feita no servidor; aqui só limita tamanho.
--  * profiles.featured_badges: até 3 medalhas em destaque no cartão.
--  * profiles.seen_unlocks: desbloqueios que a pessoa já viu comemorados.
--  * badges: catálogo de medalhas (o organizador cria e distribui).
--  * profile_badges: quem ganhou o quê, quando e por quê.

alter table public.profiles add column if not exists profile_banner text;
alter table public.profiles add column if not exists profile_effect text;
alter table public.profiles add column if not exists featured_badges text[] not null default '{}';
alter table public.profiles add column if not exists seen_unlocks text[] not null default '{}';

alter table public.profiles drop constraint if exists profiles_cosmetics_limits;
alter table public.profiles add constraint profiles_cosmetics_limits check (
  (profile_banner is null or char_length(profile_banner) <= 40)
  and (profile_effect is null or char_length(profile_effect) <= 40)
  and cardinality(featured_badges) <= 3
  and cardinality(seen_unlocks) <= 200
);

create table if not exists public.badges (
  id text primary key check (id ~ '^[a-z0-9-]{2,40}$'),
  title text not null check (char_length(title) between 2 and 60),
  description text not null default '' check (char_length(description) <= 240),
  emoji text not null default '🏅' check (char_length(emoji) <= 16),
  kind text not null default 'event' check (kind in ('tournament', 'event', 'special')),
  color text not null default 'amber' check (color in ('amber', 'purple', 'sky', 'emerald', 'rose', 'fuchsia', 'orange', 'slate')),
  sort_order integer not null default 100,
  created_at timestamptz not null default now()
);

create table if not exists public.profile_badges (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  badge_id text not null references public.badges(id) on delete cascade,
  note text check (note is null or char_length(note) <= 200),
  awarded_at timestamptz not null default now(),
  awarded_by uuid references public.profiles(id) on delete set null,
  unique (profile_id, badge_id)
);
create index if not exists profile_badges_profile_idx on public.profile_badges (profile_id);

alter table public.badges enable row level security;
alter table public.profile_badges enable row level security;

drop policy if exists "badges_select" on public.badges;
drop policy if exists "badges_insert" on public.badges;
drop policy if exists "badges_update" on public.badges;
drop policy if exists "badges_delete" on public.badges;
create policy "badges_select" on public.badges for select to authenticated using (true);
create policy "badges_insert" on public.badges for insert to authenticated with check (public.is_organizer());
create policy "badges_update" on public.badges for update to authenticated using (public.is_organizer()) with check (public.is_organizer());
create policy "badges_delete" on public.badges for delete to authenticated using (public.is_organizer());

drop policy if exists "profile_badges_select" on public.profile_badges;
drop policy if exists "profile_badges_insert" on public.profile_badges;
drop policy if exists "profile_badges_delete" on public.profile_badges;
create policy "profile_badges_select" on public.profile_badges for select to authenticated using (true);
create policy "profile_badges_insert" on public.profile_badges for insert to authenticated
  with check (public.is_organizer() and awarded_by = (select auth.uid()));
create policy "profile_badges_delete" on public.profile_badges for delete to authenticated using (public.is_organizer());

grant select, insert, update, delete on public.badges to authenticated;
grant select, insert, delete on public.profile_badges to authenticated;

-- Medalhas de exemplo (o organizador pode editar/criar outras em /admin/medalhas).
insert into public.badges (id, title, description, emoji, kind, color, sort_order) values
  ('campeao-copa-vpa', 'Campeão da Copa VPA', 'Levantou a taça da Copa VPA.', '🏆', 'tournament', 'amber', 10),
  ('vice-copa-vpa', 'Vice da Copa VPA', 'Chegou à final da Copa VPA.', '🥈', 'tournament', 'slate', 11),
  ('semifinal-copa-vpa', 'Semifinalista da Copa VPA', 'Foi até as semifinais da Copa VPA.', '🥉', 'tournament', 'orange', 12),
  ('campeao-pre-torneio', 'Campeão do Pré-Torneio', 'Venceu um pré-torneio do VPA.', '🏅', 'tournament', 'purple', 20),
  ('campeao-mini-torneio', 'Campeão de Mini Torneio', 'Venceu um mini torneio do VPA.', '🎖️', 'tournament', 'sky', 21),
  ('torneio-abril', 'Torneio Oficial de Abril', 'Disputou o torneio oficial de abril/2027.', '🌟', 'tournament', 'fuchsia', 30),
  ('fundador', 'Fundador do VPA', 'Estava aqui desde os primeiros rachas.', '💜', 'special', 'purple', 40),
  ('beta-tester', 'Beta Tester', 'Ajudou a testar as novidades do app.', '🧪', 'special', 'emerald', 41),
  ('racha-solidario', 'Racha Solidário', 'Participou de um racha beneficente do Vôlei por Amor.', '❤️', 'event', 'rose', 50),
  ('racha-especial', 'Racha Especial', 'Esteve em um racha de evento especial.', '🎉', 'event', 'amber', 51),
  ('organizacao', 'Time da Organização', 'Ajudou a fazer o VPA acontecer.', '🛠️', 'special', 'sky', 60),
  ('craque-da-temporada', 'Craque da Temporada', 'Eleito destaque da temporada.', '👑', 'special', 'amber', 70)
on conflict (id) do nothing;
