-- Pedido do organizador: quem é levantador e cai pra vaga comum (migração
-- anterior) precisa de um AVISO disso -- não pode entrar como atacante em
-- silêncio sem a pessoa saber que não conseguiu a vaga de levantador.
--
-- Muda o tipo de retorno das duas funções (de void/tabela sem a coluna pra
-- incluir `fell_back_to_regular`), então precisa dropar antes de recriar --
-- CREATE OR REPLACE não permite mudar o tipo de retorno. Reaplica as
-- mesmas permissões de antes (anon sem acesso, authenticated e
-- service_role com execute) logo em seguida, pra não perder o
-- hardening aplicado antes.
drop function if exists public.begin_event_payment_reservation(uuid);
drop function if exists public.confirm_event_participant(uuid, uuid);

create function public.begin_event_payment_reservation(p_event_id uuid)
returns table(payment_intent_id uuid, amount numeric, reservation_expires_at timestamptz, fell_back_to_regular boolean)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_profile_id uuid := auth.uid();
  v_event public.events%rowtype;
  v_profile_status public.profile_status;
  v_guest_for_event_id uuid;
  v_profile_is_setter boolean;
  v_attendance_status public.attendance_status;
  v_existing public.event_payment_intents%rowtype;
  v_capacity integer;
  v_setter_capacity integer;
  v_confirmed_total integer;
  v_confirmed_setters integer;
  v_confirmed_newcomers integer;
  v_confirmed_regulars integer;
  v_reserved_total integer;
  v_reserved_setters integer;
  v_reserved_newcomers integer;
  v_reserved_regulars integer;
  v_is_newcomer boolean;
  v_uses_setter boolean;
  v_uses_newcomer boolean;
  v_reserves_capacity boolean;
begin
  if v_profile_id is null then raise exception 'Entre na sua conta para reservar uma vaga.'; end if;

  select * into v_event from public.events e where e.id = p_event_id for update;
  if not found then raise exception 'Racha não encontrado.'; end if;
  if v_event.status in ('finished', 'cancelled', 'in_progress') then
    raise exception 'Esse racha não aceita pagamentos neste momento.';
  end if;
  if not v_event.pix_payment_enabled then
    raise exception 'O pagamento automático ainda não está ativo neste racha.';
  end if;
  if v_event.price_per_player is null or v_event.price_per_player <= 0 then
    raise exception 'Este racha ainda não possui valor para pagamento.';
  end if;

  select p.status, p.guest_for_event_id, p.is_setter
  into v_profile_status, v_guest_for_event_id, v_profile_is_setter
  from public.profiles p where p.id = v_profile_id;
  if not found then raise exception 'Perfil não encontrado.'; end if;

  v_is_newcomer := v_profile_status = 'guest' and v_guest_for_event_id = p_event_id;
  if v_profile_status <> 'approved' and not v_is_newcomer then
    raise exception 'Você precisa estar autorizado para reservar uma vaga.';
  end if;

  select a.status, a.uses_setter_spot, a.uses_newcomer_spot into v_attendance_status, v_uses_setter, v_uses_newcomer
  from public.attendance a where a.event_id = p_event_id and a.profile_id = v_profile_id;
  if v_attendance_status is null or v_attendance_status not in ('interested', 'confirmed') then
    raise exception 'Demonstre interesse neste racha antes de reservar a vaga.';
  end if;
  if v_attendance_status <> 'confirmed' then
    v_uses_setter := coalesce(v_profile_is_setter, false);
    v_uses_newcomer := v_is_newcomer and not v_uses_setter;
  else
    v_uses_setter := coalesce(v_uses_setter, false);
    v_uses_newcomer := coalesce(v_uses_newcomer, false);
  end if;

  if v_attendance_status <> 'confirmed'
     and v_event.registration_opens_at is not null
     and v_event.registration_opens_at > now() then
    raise exception 'As inscrições deste racha ainda não estão abertas.';
  end if;

  update public.event_payment_intents i
  set status = 'expired', updated_at = now()
  where i.event_id = p_event_id and i.status = 'pending' and i.reservation_expires_at <= now();

  select i.* into v_existing
  from public.event_payment_intents i
  where i.event_id = p_event_id and i.profile_id = v_profile_id and i.status in ('pending', 'paid')
  order by i.created_at desc limit 1;
  if found then
    if v_existing.status = 'paid' then raise exception 'Este racha já está pago para esta pessoa.'; end if;
    return query select v_existing.id, v_existing.amount, v_existing.reservation_expires_at,
      coalesce(v_profile_is_setter, false) and not v_existing.uses_setter_spot;
    return;
  end if;

  v_reserves_capacity := v_attendance_status <> 'confirmed';
  v_capacity := coalesce(v_event.max_players, v_event.num_teams * v_event.team_size);
  v_setter_capacity := greatest(1, ceil(v_capacity / 6.0)::integer);

  if v_reserves_capacity then
    select
      count(*)::integer,
      count(*) filter (where a.uses_setter_spot)::integer,
      count(*) filter (where a.uses_newcomer_spot)::integer,
      count(*) filter (where not a.uses_setter_spot and not a.uses_newcomer_spot)::integer
    into v_confirmed_total, v_confirmed_setters, v_confirmed_newcomers, v_confirmed_regulars
    from public.attendance a where a.event_id = p_event_id and a.status = 'confirmed';

    select
      count(*)::integer,
      count(*) filter (where i.uses_setter_spot)::integer,
      count(*) filter (where i.uses_newcomer_spot)::integer,
      count(*) filter (where not i.uses_setter_spot and not i.uses_newcomer_spot)::integer
    into v_reserved_total, v_reserved_setters, v_reserved_newcomers, v_reserved_regulars
    from public.event_payment_intents i
    where i.event_id = p_event_id and i.status = 'pending'
      and i.reservation_expires_at > now() and i.reserves_capacity;

    if v_confirmed_total + v_reserved_total >= v_capacity then
      raise exception 'As vagas deste racha já foram reservadas.';
    end if;

    if v_uses_setter and v_confirmed_setters + v_reserved_setters >= v_setter_capacity then
      v_uses_setter := false;
      v_uses_newcomer := v_is_newcomer;
    end if;

    if v_uses_setter then
      null; -- vaga de levantador garantida (checado acima, senão já virou comum)
    elsif v_uses_newcomer and v_event.newcomer_reserved_spots > 0 then
      if v_confirmed_newcomers + v_reserved_newcomers >= v_event.newcomer_reserved_spots then
        raise exception 'As vagas reservadas para novatos convidados já foram preenchidas.';
      end if;
    elsif v_confirmed_regulars + v_reserved_regulars >= v_capacity - v_setter_capacity - v_event.newcomer_reserved_spots then
      raise exception 'As vagas comuns já foram preenchidas. As restantes são exclusivas para levantadores ou novatos convidados.';
    end if;
  end if;

  return query
  insert into public.event_payment_intents as i (
    event_id, profile_id, payer_profile_id, amount, status, reservation_expires_at,
    reserves_capacity, uses_newcomer_spot, uses_setter_spot
  ) values (
    p_event_id, v_profile_id, v_profile_id, v_event.price_per_player, 'pending', now() + interval '5 minutes',
    v_reserves_capacity, v_uses_newcomer, v_uses_setter
  ) returning i.id, i.amount, i.reservation_expires_at, coalesce(v_profile_is_setter, false) and not v_uses_setter;
end;
$function$;

create function public.confirm_event_participant(p_event_id uuid, p_profile_id uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  event_row public.events%rowtype;
  participant_status public.profile_status;
  participant_guest_event_id uuid;
  participant_is_setter boolean;
  capacity integer;
  setter_capacity integer;
  confirmed_total integer;
  confirmed_setters integer;
  confirmed_newcomers integer;
  confirmed_regulars integer;
  is_newcomer boolean;
  uses_setter boolean;
  uses_newcomer boolean;
  fell_back boolean := false;
begin
  if not public.is_organizer() then
    raise exception 'Somente organizadores podem confirmar jogadores.';
  end if;

  select * into event_row from public.events where id = p_event_id for update;
  if not found then raise exception 'Racha não encontrado.'; end if;
  if event_row.status in ('finished', 'cancelled') then
    raise exception 'Esse racha não aceita mais confirmações.';
  end if;

  select status, guest_for_event_id, is_setter
  into participant_status, participant_guest_event_id, participant_is_setter
  from public.profiles where id = p_profile_id;
  if not found then raise exception 'Jogador não encontrado.'; end if;

  is_newcomer := participant_status = 'guest' and participant_guest_event_id = p_event_id;
  if participant_status <> 'approved' and not is_newcomer then
    raise exception 'Essa pessoa precisa ser membro ou estar convidada para este racha.';
  end if;

  capacity := coalesce(event_row.max_players, event_row.num_teams * event_row.team_size);
  setter_capacity := greatest(1, ceil(capacity / 6.0)::integer);
  uses_setter := coalesce(participant_is_setter, false);
  uses_newcomer := is_newcomer and not uses_setter;

  select
    count(*)::integer,
    count(*) filter (where uses_setter_spot)::integer,
    count(*) filter (where uses_newcomer_spot)::integer,
    count(*) filter (where not uses_setter_spot and not uses_newcomer_spot)::integer
  into confirmed_total, confirmed_setters, confirmed_newcomers, confirmed_regulars
  from public.attendance
  where event_id = p_event_id
    and status = 'confirmed'
    and profile_id <> p_profile_id;

  if confirmed_total >= capacity then
    raise exception 'A lista de confirmados já atingiu o limite de % vagas.', capacity;
  end if;

  if uses_setter and confirmed_setters >= setter_capacity then
    uses_setter := false;
    uses_newcomer := is_newcomer;
    fell_back := true;
  end if;

  if uses_setter then
    null; -- vaga de levantador garantida (checado acima, senão já virou comum)
  elsif uses_newcomer and event_row.newcomer_reserved_spots > 0 then
    if confirmed_newcomers >= event_row.newcomer_reserved_spots then
      raise exception 'As vagas reservadas para novatos convidados já foram preenchidas.';
    end if;
  elsif confirmed_regulars >= capacity - setter_capacity - event_row.newcomer_reserved_spots then
    raise exception 'As vagas restantes estão reservadas para levantadores ou novatos convidados.';
  end if;

  insert into public.attendance (
    event_id, profile_id, status, confirmed_at, cancelled_at, uses_newcomer_spot, uses_setter_spot
  ) values (
    p_event_id, p_profile_id, 'confirmed', now(), null, uses_newcomer, uses_setter
  )
  on conflict (event_id, profile_id) do update set
    status = 'confirmed',
    confirmed_at = now(),
    cancelled_at = null,
    uses_newcomer_spot = excluded.uses_newcomer_spot,
    uses_setter_spot = excluded.uses_setter_spot;

  if confirmed_total + 1 >= capacity then
    update public.spot_offers
    set status = 'expired', resolved_at = now()
    where event_id = p_event_id and status = 'pending' and profile_id <> p_profile_id;
  else
    update public.spot_offers
    set status = 'accepted', resolved_at = now()
    where event_id = p_event_id and status = 'pending' and profile_id = p_profile_id;
  end if;

  return fell_back;
end;
$function$;

-- O projeto tem "alter default privileges" concedendo execute pra anon
-- direto (não via PUBLIC) em toda função nova -- "revoke ... from public"
-- sozinho não bastava, repetindo o que já tinha sido aprendido na
-- migração de hardening anterior.
revoke all on function public.begin_event_payment_reservation(uuid) from anon, public;
grant execute on function public.begin_event_payment_reservation(uuid) to authenticated, service_role;

revoke all on function public.confirm_event_participant(uuid, uuid) from anon, public;
grant execute on function public.confirm_event_participant(uuid, uuid) to authenticated, service_role;
