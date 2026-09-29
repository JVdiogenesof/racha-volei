alter table public.events
  add column if not exists team_size integer not null default 6,
  add column if not exists newcomer_reserved_spots integer not null default 0;

alter table public.attendance
  add column if not exists uses_newcomer_spot boolean not null default false;

update public.attendance a
set uses_newcomer_spot = true
from public.profiles p
where p.id = a.profile_id
  and p.status = 'guest'
  and p.guest_for_event_id = a.event_id
  and a.status = 'confirmed';

alter table public.events drop constraint if exists events_team_size_check;
alter table public.events
  add constraint events_team_size_check check (team_size in (3, 4, 6));

alter table public.events drop constraint if exists events_max_players_format_check;
alter table public.events
  add constraint events_max_players_format_check check (
    max_players is null or (max_players >= 1 and max_players <= num_teams * team_size)
  );

alter table public.events drop constraint if exists events_newcomer_reserved_spots_check;
alter table public.events
  add constraint events_newcomer_reserved_spots_check check (
    newcomer_reserved_spots >= 0
    and newcomer_reserved_spots <= coalesce(max_players, num_teams * team_size)
  );

create or replace function public.confirm_event_participant(
  p_event_id uuid,
  p_profile_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  event_row public.events%rowtype;
  participant_status public.profile_status;
  participant_guest_event_id uuid;
  capacity integer;
  confirmed_total integer;
  confirmed_regulars integer;
  is_newcomer boolean;
begin
  if not public.is_organizer() then
    raise exception 'Somente organizadores podem confirmar jogadores.';
  end if;

  select * into event_row
  from public.events
  where id = p_event_id
  for update;

  if not found then raise exception 'Racha não encontrado.'; end if;
  if event_row.status in ('finished', 'cancelled') then
    raise exception 'Esse racha não aceita mais confirmações.';
  end if;

  select status, guest_for_event_id
  into participant_status, participant_guest_event_id
  from public.profiles
  where id = p_profile_id;

  if not found then raise exception 'Jogador não encontrado.'; end if;
  is_newcomer := participant_status = 'guest' and participant_guest_event_id = p_event_id;
  if participant_status <> 'approved' and not is_newcomer then
    raise exception 'Essa pessoa precisa ser membro ou estar convidada para este racha.';
  end if;

  capacity := coalesce(event_row.max_players, event_row.num_teams * event_row.team_size);

  select
    count(*)::integer,
    count(*) filter (where not a.uses_newcomer_spot)::integer
  into confirmed_total, confirmed_regulars
  from public.attendance a
  where a.event_id = p_event_id
    and a.status = 'confirmed'
    and a.profile_id <> p_profile_id;

  if confirmed_total >= capacity then
    raise exception 'A lista de confirmados já atingiu o limite de % vagas.', capacity;
  end if;

  if not is_newcomer and confirmed_regulars >= capacity - event_row.newcomer_reserved_spots then
    raise exception 'As vagas restantes estão protegidas para novatos convidados.';
  end if;

  insert into public.attendance (
    event_id, profile_id, status, confirmed_at, cancelled_at, uses_newcomer_spot
  ) values (
    p_event_id, p_profile_id, 'confirmed', now(), null, is_newcomer
  )
  on conflict (event_id, profile_id) do update set
    status = 'confirmed',
    confirmed_at = now(),
    cancelled_at = null,
    uses_newcomer_spot = excluded.uses_newcomer_spot;
end;
$$;

revoke all on function public.confirm_event_participant(uuid, uuid) from public, anon;
grant execute on function public.confirm_event_participant(uuid, uuid) to authenticated;
