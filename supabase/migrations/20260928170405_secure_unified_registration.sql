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
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  rating numeric;
begin
  if current_user_id is null then
    raise exception 'Faça login para concluir o cadastro.';
  end if;

  if exists (select 1 from public.profiles where id = current_user_id) then
    raise exception 'Este usuário já possui cadastro.';
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

  foreach rating in array array[
    p_self_attack, p_self_setting, p_self_serve,
    p_self_reception, p_self_defense, p_self_block
  ] loop
    if rating is null or rating < 0 or rating > 5 then
      raise exception 'As notas devem estar entre 0 e 5.';
    end if;
  end loop;

  insert into public.profiles (
    id, full_name, birthdate, phone, avatar_url, is_setter,
    attendance_frequency, has_vpa_shirt, wants_tournaments,
    player_level, status, is_organizer
  ) values (
    current_user_id, btrim(p_full_name), p_birthdate, btrim(p_phone), p_avatar_url, p_is_setter,
    p_attendance_frequency, p_has_vpa_shirt, p_wants_tournaments,
    p_player_level, 'visitor', false
  );

  insert into public.reserve_list (
    auth_user_id, full_name, phone, neighborhood, player_level,
    how_heard, known_people, wants_official_membership,
    self_attack, self_setting, self_serve, self_reception, self_defense, self_block
  ) values (
    current_user_id, btrim(p_full_name), btrim(p_phone), btrim(p_neighborhood), p_player_level,
    btrim(p_how_heard), btrim(p_known_people), p_wants_official_membership,
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
