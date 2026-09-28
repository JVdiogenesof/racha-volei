alter table public.reserve_list
  add column if not exists how_heard text,
  add column if not exists known_people text,
  add column if not exists wants_official_membership boolean;

-- A antiga fila de solicitações passa a fazer parte da única lista geral.
-- As notas já preenchidas são preservadas para a montagem dos times.
insert into public.reserve_list (
  auth_user_id,
  full_name,
  phone,
  player_level,
  how_heard,
  wants_official_membership,
  self_attack,
  self_setting,
  self_serve,
  self_reception,
  self_defense,
  self_block
)
select
  p.id,
  p.full_name,
  coalesce(nullif(p.phone, ''), 'Não informado'),
  p.player_level,
  'Cadastro anterior',
  true,
  max(sr.value) filter (where sr.category = 'attack'),
  max(sr.value) filter (where sr.category = 'setting'),
  max(sr.value) filter (where sr.category = 'serve'),
  max(sr.value) filter (where sr.category = 'reception'),
  max(sr.value) filter (where sr.category = 'defense'),
  max(sr.value) filter (where sr.category = 'block')
from public.profiles p
left join public.self_ratings sr on sr.profile_id = p.id
where p.status = 'pending'
group by p.id, p.full_name, p.phone, p.player_level
on conflict (auth_user_id) do nothing;

update public.profiles
set status = 'visitor', approved_by = null, guest_for_event_id = null
where status = 'pending';

drop policy if exists "profiles_insert_self" on public.profiles;

create or replace function public.is_approved()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((
    select status in ('approved', 'guest', 'visitor')
    from profiles where id = auth.uid()
  ), false);
$$;

create or replace function public.can_edit_own_profile()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select status = 'approved' from profiles where id = auth.uid()), false);
$$;

create or replace function public.register_newcomer(
  p_full_name text,
  p_birthdate date,
  p_phone text,
  p_neighborhood text,
  p_player_level public.player_level,
  p_is_setter boolean,
  p_attendance_frequency public.attendance_frequency,
  p_has_vpa_shirt boolean,
  p_wants_tournaments boolean,
  p_avatar_url text,
  p_how_heard text,
  p_known_people text,
  p_wants_official_membership boolean,
  p_self_attack numeric,
  p_self_setting numeric,
  p_self_serve numeric,
  p_self_reception numeric,
  p_self_defense numeric,
  p_self_block numeric
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Faça login para concluir o cadastro.';
  end if;

  if exists (select 1 from profiles where id = current_user_id) then
    raise exception 'Este usuário já possui cadastro.';
  end if;

  insert into profiles (
    id, full_name, birthdate, phone, avatar_url, is_setter,
    attendance_frequency, has_vpa_shirt, wants_tournaments,
    player_level, status, is_organizer
  ) values (
    current_user_id, p_full_name, p_birthdate, p_phone, p_avatar_url, p_is_setter,
    p_attendance_frequency, p_has_vpa_shirt, p_wants_tournaments,
    p_player_level, 'visitor', false
  );

  insert into reserve_list (
    auth_user_id, full_name, phone, neighborhood, player_level,
    how_heard, known_people, wants_official_membership,
    self_attack, self_setting, self_serve, self_reception, self_defense, self_block
  ) values (
    current_user_id, p_full_name, p_phone, p_neighborhood, p_player_level,
    p_how_heard, nullif(p_known_people, ''), p_wants_official_membership,
    p_self_attack, p_self_setting, p_self_serve, p_self_reception, p_self_defense, p_self_block
  );
end;
$$;

revoke all on function public.register_newcomer(
  text, date, text, text, public.player_level, boolean,
  public.attendance_frequency, boolean, boolean, text, text, text, boolean,
  numeric, numeric, numeric, numeric, numeric, numeric
) from public, anon;

grant execute on function public.register_newcomer(
  text, date, text, text, public.player_level, boolean,
  public.attendance_frequency, boolean, boolean, text, text, text, boolean,
  numeric, numeric, numeric, numeric, numeric, numeric
) to authenticated;
