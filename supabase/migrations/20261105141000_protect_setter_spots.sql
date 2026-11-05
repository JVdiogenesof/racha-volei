-- Cota de levantador furada: um atacante entrou com 17 confirmados, faltando 1
-- levantador. Novatos convidados (uses_newcomer_spot) não entravam na conta das
-- vagas comuns quando o racha não reserva vagas para novatos, então sobrava
-- espaço de mentira e a vaga de levantador era ocupada.
--
-- Agora novato além da cota de novatos conta como vaga comum em todos os
-- caminhos de entrada, e a fila só chama levantador quando só resta vaga de levantador.
--
-- Regra do organizador para a quantidade: 1 levantador a cada 6 jogadores,
-- arredondando para baixo (18 e 20 jogadores = 3; 24 jogadores = 4).

CREATE OR REPLACE FUNCTION public.begin_event_payment_reservation(p_event_id uuid)
 RETURNS TABLE(payment_intent_id uuid, amount numeric, reservation_expires_at timestamp with time zone, fell_back_to_regular boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  -- A marcação manual de levantador neste racha vale mais que o perfil.
  select coalesce((select o.is_setter from public.event_setter_overrides o where o.event_id = p_event_id and o.profile_id = v_profile_id), v_profile_is_setter) into v_profile_is_setter;

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
  v_setter_capacity := greatest(1, floor(v_capacity / 6.0)::integer);

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
    elsif v_confirmed_regulars + v_reserved_regulars + greatest(0, v_confirmed_newcomers + v_reserved_newcomers - v_event.newcomer_reserved_spots) >= v_capacity - v_setter_capacity - v_event.newcomer_reserved_spots then
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

CREATE OR REPLACE FUNCTION public.confirm_event_participant(p_event_id uuid, p_profile_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  -- A marcação manual de levantador neste racha vale mais que o perfil.
  select coalesce((select o.is_setter from public.event_setter_overrides o where o.event_id = p_event_id and o.profile_id = p_profile_id), participant_is_setter) into participant_is_setter;

  is_newcomer := participant_status = 'guest' and participant_guest_event_id = p_event_id;
  if participant_status <> 'approved' and not is_newcomer then
    raise exception 'Essa pessoa precisa ser membro ou estar convidada para este racha.';
  end if;

  capacity := coalesce(event_row.max_players, event_row.num_teams * event_row.team_size);
  setter_capacity := greatest(1, floor(capacity / 6.0)::integer);
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
  elsif confirmed_regulars + greatest(0, confirmed_newcomers - event_row.newcomer_reserved_spots) >= capacity - setter_capacity - event_row.newcomer_reserved_spots then
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

CREATE OR REPLACE FUNCTION public.complete_event_pix_payment(p_intent_id uuid, p_provider_order_id text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_intent public.event_payment_intents%rowtype;
  v_event public.events%rowtype;
  v_payment_id uuid;
  v_expired boolean;
  v_capacity integer;
  v_setter_capacity integer;
  v_confirmed_total integer; v_confirmed_setters integer; v_confirmed_newcomers integer; v_confirmed_regulars integer;
  v_reserved_total integer; v_reserved_setters integer; v_reserved_newcomers integer; v_reserved_regulars integer;
begin
  select * into v_intent from public.event_payment_intents where id = p_intent_id for update;
  if not found then raise exception 'Reserva de pagamento não encontrada.'; end if;
  if v_intent.provider <> 'mercado_pago' or v_intent.provider_order_id <> trim(p_provider_order_id) then
    raise exception 'A cobrança não corresponde à reserva.';
  end if;
  if v_intent.status = 'paid' then return v_intent.payment_id; end if;
  if v_intent.status not in ('pending', 'expired') then
    raise exception 'A reserva já expirou. O pagamento será tratado pelo atendimento.';
  end if;

  select * into v_event from public.events where id = v_intent.event_id for update;
  if not found or v_event.status in ('finished', 'cancelled', 'in_progress') then
    raise exception 'A reserva já expirou: este racha não aceita mais confirmação automática.';
  end if;

  v_expired := v_intent.status = 'expired' or v_intent.reservation_expires_at <= now();

  if v_expired and v_intent.reserves_capacity then
    v_capacity := coalesce(v_event.max_players, v_event.num_teams * v_event.team_size);
    v_setter_capacity := greatest(1, floor(v_capacity / 6.0)::integer);

    select count(*)::integer,
           count(*) filter (where a.uses_setter_spot)::integer,
           count(*) filter (where a.uses_newcomer_spot)::integer,
           count(*) filter (where not a.uses_setter_spot and not a.uses_newcomer_spot)::integer
    into v_confirmed_total, v_confirmed_setters, v_confirmed_newcomers, v_confirmed_regulars
    from public.attendance a
    where a.event_id = v_intent.event_id and a.status = 'confirmed' and a.profile_id <> v_intent.profile_id;

    select count(*)::integer,
           count(*) filter (where i.uses_setter_spot)::integer,
           count(*) filter (where i.uses_newcomer_spot)::integer,
           count(*) filter (where not i.uses_setter_spot and not i.uses_newcomer_spot)::integer
    into v_reserved_total, v_reserved_setters, v_reserved_newcomers, v_reserved_regulars
    from public.event_payment_intents i
    where i.event_id = v_intent.event_id and i.id <> v_intent.id and i.status = 'pending'
      and i.reservation_expires_at > now() and i.reserves_capacity;

    if v_confirmed_total + v_reserved_total >= v_capacity
       or (v_intent.uses_setter_spot and v_confirmed_setters + v_reserved_setters >= v_setter_capacity)
       or (not v_intent.uses_setter_spot and v_intent.uses_newcomer_spot and v_event.newcomer_reserved_spots > 0
           and v_confirmed_newcomers + v_reserved_newcomers >= v_event.newcomer_reserved_spots)
       or (not v_intent.uses_setter_spot and (not v_intent.uses_newcomer_spot or v_event.newcomer_reserved_spots = 0)
           and v_confirmed_regulars + v_reserved_regulars + greatest(0, v_confirmed_newcomers + v_reserved_newcomers - v_event.newcomer_reserved_spots) >= v_capacity - v_setter_capacity - v_event.newcomer_reserved_spots) then
      raise exception 'A reserva já expirou e a vaga foi preenchida por outra pessoa.';
    end if;
  end if;

  update public.attendance
  set status = 'confirmed', confirmed_at = now(), cancelled_at = null,
      uses_newcomer_spot = v_intent.uses_newcomer_spot,
      uses_setter_spot = v_intent.uses_setter_spot
  where event_id = v_intent.event_id and profile_id = v_intent.profile_id;
  if not found then raise exception 'A reserva já expirou e a pessoa não possui interesse ativo neste racha.'; end if;

  insert into public.payments (event_id, profile_id, paid, paid_at, marked_by, amount, payment_source, balance_entry_id)
  values (v_intent.event_id, v_intent.profile_id, true, now(), v_event.created_by, v_intent.amount, 'pix', null)
  on conflict (event_id, profile_id) do update set
    paid = true, paid_at = excluded.paid_at, marked_by = excluded.marked_by,
    amount = excluded.amount, payment_source = 'pix', balance_entry_id = null
  returning id into v_payment_id;

  update public.event_payment_intents
  set status = 'paid', payment_id = v_payment_id, paid_at = now(), updated_at = now()
  where id = v_intent.id;

  -- Se essa pessoa pagou a vaga que a fila automática tinha reservado pra
  -- ela, marca a oferta como aceita em vez de deixar "pendente" até vencer
  -- sozinha (evita travar uma outra vaga aberta por engano nesse meio tempo).
  update public.spot_offers
  set status = 'accepted', resolved_at = now()
  where event_id = v_intent.event_id and profile_id = v_intent.profile_id and status = 'pending';

  return v_payment_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.credit_late_event_pix_payment(p_intent_id uuid, p_provider_order_id text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_intent public.event_payment_intents%rowtype;
  v_event public.events%rowtype;
  v_entry_id uuid;
  v_payment_id uuid;
  v_capacity integer;
  v_setter_capacity integer;
  v_confirmed_total integer; v_confirmed_setters integer; v_confirmed_newcomers integer; v_confirmed_regulars integer;
  v_reserved_total integer; v_reserved_setters integer; v_reserved_newcomers integer; v_reserved_regulars integer;
  v_has_room boolean;
begin
  select * into v_intent from public.event_payment_intents where id = p_intent_id for update;
  if not found then raise exception 'Reserva de pagamento não encontrada.'; end if;
  if v_intent.provider <> 'mercado_pago' or v_intent.provider_order_id <> trim(p_provider_order_id) then
    raise exception 'A cobrança não corresponde à reserva.';
  end if;
  if v_intent.status = 'paid' then return null; end if;
  if v_intent.status = 'credited' then return null; end if;
  if v_intent.status not in ('pending', 'expired') then
    raise exception 'Esta reserva não pode receber saldo automático.';
  end if;
  if v_intent.status = 'pending' and v_intent.reservation_expires_at > now() then
    raise exception 'A reserva ainda está ativa.';
  end if;

  select * into v_event from public.events where id = v_intent.event_id for update;
  if not found then raise exception 'Racha não encontrado.'; end if;

  v_has_room := false;
  if v_event.status not in ('finished', 'cancelled', 'in_progress') and v_intent.reserves_capacity then
    v_capacity := coalesce(v_event.max_players, v_event.num_teams * v_event.team_size);
    v_setter_capacity := greatest(1, floor(v_capacity / 6.0)::integer);

    select count(*)::integer,
           count(*) filter (where a.uses_setter_spot)::integer,
           count(*) filter (where a.uses_newcomer_spot)::integer,
           count(*) filter (where not a.uses_setter_spot and not a.uses_newcomer_spot)::integer
    into v_confirmed_total, v_confirmed_setters, v_confirmed_newcomers, v_confirmed_regulars
    from public.attendance a
    where a.event_id = v_intent.event_id and a.status = 'confirmed' and a.profile_id <> v_intent.profile_id;

    select count(*)::integer,
           count(*) filter (where i.uses_setter_spot)::integer,
           count(*) filter (where i.uses_newcomer_spot)::integer,
           count(*) filter (where not i.uses_setter_spot and not i.uses_newcomer_spot)::integer
    into v_reserved_total, v_reserved_setters, v_reserved_newcomers, v_reserved_regulars
    from public.event_payment_intents i
    where i.event_id = v_intent.event_id and i.id <> v_intent.id and i.status = 'pending'
      and i.reservation_expires_at > now() and i.reserves_capacity;

    v_has_room := v_confirmed_total + v_reserved_total < v_capacity
      and not (v_intent.uses_setter_spot and v_confirmed_setters + v_reserved_setters >= v_setter_capacity)
      and not (not v_intent.uses_setter_spot and v_intent.uses_newcomer_spot and v_event.newcomer_reserved_spots > 0
               and v_confirmed_newcomers + v_reserved_newcomers >= v_event.newcomer_reserved_spots)
      and not (not v_intent.uses_setter_spot and (not v_intent.uses_newcomer_spot or v_event.newcomer_reserved_spots = 0)
               and v_confirmed_regulars + v_reserved_regulars + greatest(0, v_confirmed_newcomers + v_reserved_newcomers - v_event.newcomer_reserved_spots) >= v_capacity - v_setter_capacity - v_event.newcomer_reserved_spots);
  elsif v_event.status not in ('finished', 'cancelled', 'in_progress') and not v_intent.reserves_capacity then
    -- Já estava confirmado quando reservou (ex: vaga garantida) -- sempre cabe.
    v_has_room := true;
  end if;

  if v_has_room then
    update public.attendance
    set status = 'confirmed', confirmed_at = now(), cancelled_at = null,
        uses_newcomer_spot = v_intent.uses_newcomer_spot,
        uses_setter_spot = v_intent.uses_setter_spot
    where event_id = v_intent.event_id and profile_id = v_intent.profile_id;

    if found then
      insert into public.payments (event_id, profile_id, paid, paid_at, marked_by, amount, payment_source, balance_entry_id)
      values (v_intent.event_id, v_intent.profile_id, true, now(), v_event.created_by, v_intent.amount, 'pix', null)
      on conflict (event_id, profile_id) do update set
        paid = true, paid_at = excluded.paid_at, marked_by = excluded.marked_by,
        amount = excluded.amount, payment_source = 'pix', balance_entry_id = null
      returning id into v_payment_id;

      update public.event_payment_intents
      set status = 'paid', payment_id = v_payment_id, paid_at = now(), updated_at = now()
      where id = v_intent.id;

      update public.spot_offers
      set status = 'accepted', resolved_at = now()
      where event_id = v_intent.event_id and profile_id = v_intent.profile_id and status = 'pending';

      return v_payment_id;
    end if;
  end if;

  -- Sem vaga (ou sem interesse ativo pra ocupar): o valor vira saldo, igual
  -- já era antes dessa revisão.
  insert into public.player_balance_entries (
    profile_id, community, entry_type, amount, category, cash_effect,
    description, event_id, created_by
  ) values (
    v_intent.profile_id, v_event.community, 'credit', v_intent.amount,
    'advance_payment', 'income', 'Pix recebido após a reserva expirar',
    v_intent.event_id, v_event.created_by
  ) returning id into v_entry_id;

  insert into public.finance_transactions (
    community, transaction_type, category, description, amount, transaction_date,
    profile_id, event_id, balance_entry_id, created_by
  ) values (
    v_event.community, 'income', 'balance', 'Pix recebido após a reserva expirar',
    v_intent.amount, current_date, v_intent.profile_id, v_event.id, v_entry_id, v_event.created_by
  );

  update public.event_payment_intents
  set status = 'credited', paid_at = now(), updated_at = now()
  where id = v_intent.id;

  return v_entry_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.advance_spot_offer(p_event_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_event public.events%rowtype;
  v_capacity integer;
  v_confirmed integer;
  v_pending public.spot_offers%rowtype;
  v_next_profile_id uuid;
  v_setter_capacity integer;
  v_setters integer;
  v_newcomers integer;
  v_regular_open boolean;
begin
  select * into v_event from public.events where id = p_event_id for update;
  if not found or v_event.status in ('finished', 'cancelled') then
    return null;
  end if;

  -- Oferta pendente vencida, ou de quem nem está mais interessado: encerra e
  -- tira a pessoa da lista de interessados.
  select * into v_pending from public.spot_offers s
    where s.event_id = p_event_id and s.status = 'pending'
      and (
        s.expires_at <= now()
        or not exists (
          select 1 from public.attendance a
          where a.event_id = p_event_id and a.profile_id = s.profile_id and a.status = 'interested'
        )
      )
    for update;
  if found then
    update public.spot_offers set status = 'expired', resolved_at = now() where id = v_pending.id;
    update public.attendance set status = 'declined', cancelled_at = now()
      where event_id = p_event_id and profile_id = v_pending.profile_id and status = 'interested';
  end if;

  -- Já existe oferta pendente em aberto (não vencida): não faz nada agora.
  if exists (
    select 1 from public.spot_offers
    where event_id = p_event_id and status = 'pending' and expires_at > now()
  ) then
    return null;
  end if;

  -- Times já sorteados ou racha em andamento: não chama mais ninguém novo
  -- sozinho -- quem entrar agora não teria time nenhum.
  if v_event.status in ('teams_generated', 'in_progress') then
    return null;
  end if;

  v_capacity := coalesce(v_event.max_players, v_event.num_teams * v_event.team_size);
  select count(*) into v_confirmed from public.attendance where event_id = p_event_id and status = 'confirmed';
  -- A fila só vale com a lista cheia: lotada não há o que oferecer, e com 2 ou
  -- mais vagas livres qualquer pessoa pode entrar direto.
  if v_capacity - v_confirmed <> 1 then
    return null;
  end if;

  -- Se o que sobra é vaga de levantador, só chama quem é levantador.
  v_setter_capacity := greatest(1, floor(v_capacity / 6.0)::integer);
  select count(*) filter (where uses_setter_spot)::integer,
         count(*) filter (where uses_newcomer_spot and not uses_setter_spot)::integer
    into v_setters, v_newcomers
    from public.attendance where event_id = p_event_id and status = 'confirmed';
  v_regular_open := v_confirmed - v_setters - least(v_newcomers, v_event.newcomer_reserved_spots)
    < v_capacity - v_setter_capacity - v_event.newcomer_reserved_spots;

  select a.profile_id into v_next_profile_id
    from public.attendance a
    join public.profiles p on p.id = a.profile_id
    where a.event_id = p_event_id and a.status = 'interested'
      and (p.status = 'approved' or (p.status = 'guest' and p.guest_for_event_id = p_event_id))
      and not exists (select 1 from public.spot_offers so where so.event_id = p_event_id and so.profile_id = a.profile_id)
      and (
        v_regular_open
        or (coalesce((select o.is_setter from public.event_setter_overrides o where o.event_id = p_event_id and o.profile_id = a.profile_id), p.is_setter) and v_setters < v_setter_capacity)
        or (p.status = 'guest' and not coalesce((select o.is_setter from public.event_setter_overrides o where o.event_id = p_event_id and o.profile_id = a.profile_id), p.is_setter) and v_newcomers < v_event.newcomer_reserved_spots)
      )
    order by a.confirmed_at asc
    limit 1;

  if v_next_profile_id is null then
    return null;
  end if;

  insert into public.spot_offers (event_id, profile_id, status, offered_at, expires_at)
  values (p_event_id, v_next_profile_id, 'pending', now(), now() + interval '1 hour');

  return v_next_profile_id;
end;
$function$;

-- Quem já foi marcado manualmente como levantador passa a contar na cota.
update public.attendance a
set uses_setter_spot = o.is_setter,
    uses_newcomer_spot = case when o.is_setter then false else a.uses_newcomer_spot end
from public.event_setter_overrides o, public.events e
where o.event_id = a.event_id and o.profile_id = a.profile_id and e.id = a.event_id
  and a.status = 'confirmed' and a.uses_setter_spot <> o.is_setter
  and e.status not in ('finished', 'cancelled') and e.date >= current_date;
