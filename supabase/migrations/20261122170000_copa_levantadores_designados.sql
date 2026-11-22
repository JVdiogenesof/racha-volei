-- Na Copa só jogam de levantador os primeiros levantadores classificados (um por
-- time). Os demais, mesmo sendo levantadores no cadastro, entram como jogadores
-- normais, sem selo. Migração aditiva.
alter table public.cup_qualified_players
  add column if not exists plays_as_setter boolean not null default false;

drop policy if exists "cup_qualified_players_update_organizer" on public.cup_qualified_players;
create policy "cup_qualified_players_update_organizer" on public.cup_qualified_players for update to authenticated
  using ((select public.is_organizer()))
  with check ((select public.is_organizer()));
