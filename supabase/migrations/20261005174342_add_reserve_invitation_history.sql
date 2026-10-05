create table if not exists public.reserve_invitations (
  id uuid primary key default gen_random_uuid(),
  reserve_entry_id uuid not null references public.reserve_list(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  invited_by uuid references public.profiles(id) on delete set null,
  invited_at timestamptz not null default now(),
  constraint reserve_invitations_entry_event_unique unique (reserve_entry_id, event_id)
);

create index if not exists reserve_invitations_entry_invited_at_idx
  on public.reserve_invitations (reserve_entry_id, invited_at desc);

alter table public.reserve_invitations enable row level security;
revoke all on table public.reserve_invitations from anon, authenticated;
grant select on table public.reserve_invitations to authenticated;

drop policy if exists "reserve_invitations_select_organizer" on public.reserve_invitations;
create policy "reserve_invitations_select_organizer"
  on public.reserve_invitations
  for select
  to authenticated
  using ((select public.is_organizer()));

-- Recupera convites anteriores que deixaram uma resposta de presença. Antes
-- desta tabela o app mantinha somente o convite ativo no perfil.
insert into public.reserve_invitations (reserve_entry_id, event_id, invited_at)
select distinct on (r.id, a.event_id)
  r.id,
  a.event_id,
  coalesce(a.confirmed_at, now())
from public.reserve_list r
join public.attendance a on a.profile_id = r.auth_user_id
order by r.id, a.event_id, a.confirmed_at asc
on conflict (reserve_entry_id, event_id) do nothing;

-- Também preserva convites ativos que ainda não tiveram resposta no racha.
insert into public.reserve_invitations (reserve_entry_id, event_id)
select r.id, p.guest_for_event_id
from public.reserve_list r
join public.profiles p on p.id = r.auth_user_id
where p.status = 'guest'
  and p.guest_for_event_id is not null
on conflict (reserve_entry_id, event_id) do nothing;

create or replace function public.invite_reserve_to_event(
  p_reserve_entry_id uuid,
  p_event_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  entry public.reserve_list%rowtype;
  target_community text;
begin
  if not public.is_organizer() then
    raise exception 'Somente organizadores podem chamar pessoas para um racha.';
  end if;

  select community into target_community
  from public.events
  where id = p_event_id
    and date >= timezone('America/Fortaleza', now())::date
    and status in ('open', 'teams_generated');

  if not found then
    raise exception 'Esse racha não está mais disponível para convites.';
  end if;

  select * into entry from public.reserve_list where id = p_reserve_entry_id;
  if not found then
    raise exception 'Pessoa não encontrada na lista de reserva.';
  end if;

  if not (entry.communities @> array[target_community]) then
    raise exception 'Essa pessoa não está cadastrada nessa modalidade.';
  end if;

  insert into public.profiles (
    id, full_name, phone, instagram_handle, player_level, communities,
    status, is_organizer, guest_for_event_id, approved_by
  ) values (
    entry.auth_user_id, entry.full_name, entry.phone, entry.instagram_handle,
    entry.player_level, entry.communities, 'guest', false, p_event_id, auth.uid()
  )
  on conflict (id) do update set
    full_name = excluded.full_name,
    phone = excluded.phone,
    instagram_handle = coalesce(excluded.instagram_handle, profiles.instagram_handle),
    player_level = coalesce(excluded.player_level, profiles.player_level),
    communities = excluded.communities,
    status = 'guest',
    guest_for_event_id = excluded.guest_for_event_id,
    approved_by = auth.uid();

  insert into public.self_ratings (profile_id, category, value)
  values
    (entry.auth_user_id, 'attack', coalesce(entry.self_attack, 2.5)),
    (entry.auth_user_id, 'setting', coalesce(entry.self_setting, 2.5)),
    (entry.auth_user_id, 'serve', coalesce(entry.self_serve, 2.5)),
    (entry.auth_user_id, 'reception', coalesce(entry.self_reception, 2.5)),
    (entry.auth_user_id, 'defense', coalesce(entry.self_defense, 2.5)),
    (entry.auth_user_id, 'block', coalesce(entry.self_block, 2.5))
  on conflict (profile_id, category) do update
    set value = excluded.value, updated_at = now();

  insert into public.reserve_invitations (reserve_entry_id, event_id, invited_by)
  values (entry.id, p_event_id, auth.uid())
  on conflict (reserve_entry_id, event_id) do update
    set invited_at = now(), invited_by = excluded.invited_by;

  update public.reserve_list set contacted = true where id = entry.id;

  return entry.auth_user_id;
end;
$$;

revoke all on function public.invite_reserve_to_event(uuid, uuid) from public, anon;
grant execute on function public.invite_reserve_to_event(uuid, uuid) to authenticated;
