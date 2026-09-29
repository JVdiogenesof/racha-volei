alter table public.profiles add column if not exists instagram_handle text;
alter table public.reserve_list add column if not exists instagram_handle text;

create or replace function public.invite_reserve_to_event(
  p_reserve_entry_id uuid,
  p_event_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  entry public.reserve_list%rowtype;
begin
  if not public.is_organizer() then
    raise exception 'Somente organizadores podem chamar pessoas para um racha.';
  end if;

  if not exists (
    select 1 from public.events
    where id = p_event_id
      and date >= timezone('America/Fortaleza', now())::date
      and status in ('open', 'teams_generated')
  ) then
    raise exception 'Esse racha não está mais disponível para convites.';
  end if;

  select * into entry from public.reserve_list where id = p_reserve_entry_id;
  if not found then raise exception 'Pessoa não encontrada na lista de reserva.'; end if;

  insert into public.profiles (
    id, full_name, phone, instagram_handle, player_level,
    status, is_organizer, guest_for_event_id
  ) values (
    entry.auth_user_id, entry.full_name, entry.phone, entry.instagram_handle, entry.player_level,
    'guest', false, p_event_id
  )
  on conflict (id) do update set
    full_name = excluded.full_name,
    phone = excluded.phone,
    instagram_handle = coalesce(excluded.instagram_handle, profiles.instagram_handle),
    player_level = coalesce(excluded.player_level, profiles.player_level),
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

  return entry.auth_user_id;
end;
$$;

create or replace function public.promote_reserve_to_member(p_reserve_entry_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  entry public.reserve_list%rowtype;
begin
  if not public.is_organizer() then
    raise exception 'Somente organizadores podem liberar acesso completo.';
  end if;

  select * into entry from public.reserve_list where id = p_reserve_entry_id;
  if not found then raise exception 'Pessoa não encontrada na lista de reserva.'; end if;

  insert into public.profiles (
    id, full_name, phone, instagram_handle, player_level,
    status, is_organizer, guest_for_event_id, approved_by
  ) values (
    entry.auth_user_id, entry.full_name, entry.phone, entry.instagram_handle, entry.player_level,
    'approved', false, null, auth.uid()
  )
  on conflict (id) do update set
    full_name = excluded.full_name,
    phone = excluded.phone,
    instagram_handle = coalesce(excluded.instagram_handle, profiles.instagram_handle),
    player_level = coalesce(excluded.player_level, profiles.player_level),
    status = 'approved',
    guest_for_event_id = null,
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

  delete from public.reserve_list where id = entry.id;
  return entry.auth_user_id;
end;
$$;

revoke all on function public.invite_reserve_to_event(uuid, uuid) from public, anon;
revoke all on function public.promote_reserve_to_member(uuid) from public, anon;
grant execute on function public.invite_reserve_to_event(uuid, uuid) to authenticated;
grant execute on function public.promote_reserve_to_member(uuid) to authenticated;

create or replace function public.register_newcomer(
  p_full_name text,
  p_birthdate date,
  p_phone text,
  p_instagram_handle text,
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
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  rating numeric;
  normalized_instagram text := lower(btrim(p_instagram_handle));
begin
  if current_user_id is null then raise exception 'Faça login para concluir o cadastro.'; end if;
  if exists (select 1 from public.profiles where id = current_user_id) then
    raise exception 'Este usuário já possui cadastro.';
  end if;

  if left(normalized_instagram, 1) <> '@' then normalized_instagram := '@' || normalized_instagram; end if;
  if normalized_instagram !~ '^@[a-z0-9._]{1,30}$' then
    raise exception 'Informe um @ do Instagram válido.';
  end if;

  if nullif(btrim(p_full_name), '') is null
    or p_birthdate is null
    or nullif(btrim(p_phone), '') is null
    or nullif(btrim(p_neighborhood), '') is null
    or nullif(btrim(p_how_heard), '') is null
    or nullif(btrim(p_known_people), '') is null
    or p_wants_official_membership is null then
    raise exception 'Preencha todos os campos obrigatórios.';
  end if;

  foreach rating in array array[p_self_attack, p_self_setting, p_self_serve, p_self_reception, p_self_defense, p_self_block] loop
    if rating is null or rating < 0 or rating > 5 then raise exception 'As notas devem estar entre 0 e 5.'; end if;
  end loop;

  insert into public.profiles (
    id, full_name, birthdate, phone, instagram_handle, avatar_url, is_setter,
    attendance_frequency, has_vpa_shirt, wants_tournaments,
    player_level, status, is_organizer
  ) values (
    current_user_id, btrim(p_full_name), p_birthdate, btrim(p_phone), normalized_instagram,
    p_avatar_url, p_is_setter, p_attendance_frequency, p_has_vpa_shirt,
    p_wants_tournaments, p_player_level, 'visitor', false
  );

  insert into public.reserve_list (
    auth_user_id, full_name, phone, instagram_handle, neighborhood, player_level,
    how_heard, known_people, wants_official_membership,
    self_attack, self_setting, self_serve, self_reception, self_defense, self_block
  ) values (
    current_user_id, btrim(p_full_name), btrim(p_phone), normalized_instagram,
    btrim(p_neighborhood), p_player_level, btrim(p_how_heard), btrim(p_known_people),
    p_wants_official_membership, p_self_attack, p_self_setting, p_self_serve,
    p_self_reception, p_self_defense, p_self_block
  );
end;
$$;

revoke all on function public.register_newcomer(
  text, date, text, text, text, public.player_level, boolean,
  public.attendance_frequency, boolean, boolean, text, text, text, boolean,
  numeric, numeric, numeric, numeric, numeric, numeric
) from public, anon;
grant execute on function public.register_newcomer(
  text, date, text, text, text, public.player_level, boolean,
  public.attendance_frequency, boolean, boolean, text, text, text, boolean,
  numeric, numeric, numeric, numeric, numeric, numeric
) to authenticated;
