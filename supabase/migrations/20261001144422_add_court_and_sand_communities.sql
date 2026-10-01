alter table public.profiles
  add column if not exists communities text[] not null default array['court']::text[];

alter table public.events
  add column if not exists community text not null default 'court';

alter table public.announcements
  add column if not exists community text not null default 'court';

alter table public.ranking_adjustments
  add column if not exists community text not null default 'court';

alter table public.reserve_list
  add column if not exists communities text[] not null default array['court']::text[];

alter table public.tournament_reserved_players
  add column if not exists community text not null default 'court';

alter table public.profiles drop constraint if exists profiles_communities_valid;
alter table public.profiles add constraint profiles_communities_valid check (
  cardinality(communities) between 1 and 2
  and communities <@ array['court', 'sand']::text[]
);

alter table public.reserve_list drop constraint if exists reserve_list_communities_valid;
alter table public.reserve_list add constraint reserve_list_communities_valid check (
  cardinality(communities) between 1 and 2
  and communities <@ array['court', 'sand']::text[]
);

alter table public.events drop constraint if exists events_community_valid;
alter table public.events add constraint events_community_valid check (community in ('court', 'sand'));
alter table public.announcements drop constraint if exists announcements_community_valid;
alter table public.announcements add constraint announcements_community_valid check (community in ('court', 'sand'));
alter table public.ranking_adjustments drop constraint if exists ranking_adjustments_community_valid;
alter table public.ranking_adjustments add constraint ranking_adjustments_community_valid check (community in ('court', 'sand'));
alter table public.tournament_reserved_players drop constraint if exists tournament_reserved_players_community_valid;
alter table public.tournament_reserved_players add constraint tournament_reserved_players_community_valid check (community in ('court', 'sand'));

do $$
declare
  constraint_to_drop text;
begin
  for constraint_to_drop in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'tournament_reserved_players'
      and con.contype = 'u'
      and array_length(con.conkey, 1) = 1
      and exists (
        select 1
        from pg_attribute attr
        where attr.attrelid = rel.oid
          and attr.attnum = con.conkey[1]
          and attr.attname = 'profile_id'
      )
  loop
    execute format('alter table public.tournament_reserved_players drop constraint %I', constraint_to_drop);
  end loop;
end;
$$;
alter table public.tournament_reserved_players drop constraint if exists tournament_reserved_players_profile_community_unique;
alter table public.tournament_reserved_players add constraint tournament_reserved_players_profile_community_unique unique (profile_id, community);

-- Tudo que já existia pertence ao racha de quadra. Organizadores precisam
-- alternar entre os dois ambientes para preparar o lançamento da areia.
update public.profiles
set communities = array['court', 'sand']::text[]
where is_organizer = true;

create index if not exists profiles_communities_gin_idx on public.profiles using gin (communities);
create index if not exists reserve_list_communities_gin_idx on public.reserve_list using gin (communities);
create index if not exists events_community_date_idx on public.events (community, date);
create index if not exists announcements_community_created_idx on public.announcements (community, created_at desc);
create index if not exists ranking_adjustments_community_idx on public.ranking_adjustments (community, created_at desc);
create index if not exists tournament_reserved_players_community_idx on public.tournament_reserved_players (community, added_at desc);

-- Chamado logo depois do cadastro unificado. Mantém a função de cadastro
-- existente compatível e permite gravar a escolha Quadra/Areia/Ambos.
create or replace function public.set_my_communities(p_communities text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  normalized text[];
begin
  if current_user_id is null then
    raise exception 'Faça login para escolher seu racha.';
  end if;

  select array_agg(distinct value order by value)
  into normalized
  from unnest(p_communities) as selected(value)
  where value in ('court', 'sand');

  if normalized is null or cardinality(normalized) < 1 or cardinality(normalized) > 2 then
    raise exception 'Escolha Quadra, Areia ou Ambos.';
  end if;

  update public.profiles set communities = normalized where id = current_user_id;
  update public.reserve_list set communities = normalized where auth_user_id = current_user_id;
end;
$$;

revoke all on function public.set_my_communities(text[]) from public, anon;
grant execute on function public.set_my_communities(text[]) to authenticated;

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
