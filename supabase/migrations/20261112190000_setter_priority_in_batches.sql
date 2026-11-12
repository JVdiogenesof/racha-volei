-- Levantadores têm prioridade independente do lote: com vaga de levantador
-- sobrando, o levantador reserva mesmo com o Lote 1 cheio. E o Lote 1 guarda
-- até 3 vagas para levantadores enquanto eles não chegarem.
-- Mesmos corpos de 20261112170000_event_spot_batches.sql + essas regras.

create or replace function public.begin_event_payment_reservation(p_event_id uuid)
returns table(payment_intent_id uuid, amount numeric, reservation_expires_at timestamp with time zone, fell_back_to_regular boolean)
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
  v_public_capacity integer;
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
  v_public_capacity := public.event_public_capacity(v_event);
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

    -- Levantador com vaga de levantador sobrando tem prioridade e não depende
    -- do lote. Para os demais, o Lote 1 guarda até 3 vagas para levantadores
    -- (enquanto eles não chegarem) e o restante só abre no Lote 2.
    if v_public_capacity < v_capacity
       and not (v_uses_setter and v_confirmed_setters + v_reserved_setters < v_setter_capacity) then
      if v_confirmed_total + v_reserved_total >= v_public_capacity then
        raise exception 'As vagas do Lote 1 já foram preenchidas. O Lote 2 abre em %.',
          to_char(v_event.second_batch_opens_at at time zone 'America/Fortaleza', 'DD/MM "às" HH24:MI');
      end if;
      if v_confirmed_total + v_reserved_total
         + greatest(0, least(3, v_setter_capacity) - v_confirmed_setters - v_reserved_setters) >= v_public_capacity then
        raise exception 'As vagas restantes do Lote 1 estão guardadas para levantadores. O Lote 2 abre em %.',
          to_char(v_event.second_batch_opens_at at time zone 'America/Fortaleza', 'DD/MM "às" HH24:MI');
      end if;
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

create or replace function public.advance_spot_offer(p_event_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_event public.events%rowtype;
  v_capacity integer;
  v_public_capacity integer;
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
  v_public_capacity := public.event_public_capacity(v_event);
  select count(*) into v_confirmed from public.attendance where event_id = p_event_id and status = 'confirmed';

  v_setter_capacity := greatest(1, floor(v_capacity / 6.0)::integer);
  select count(*) filter (where uses_setter_spot)::integer,
         count(*) filter (where uses_newcomer_spot and not uses_setter_spot)::integer
    into v_setters, v_newcomers
    from public.attendance where event_id = p_event_id and status = 'confirmed';

  -- No Lote 1, até 3 vagas ficam guardadas para levantadores (o levantador
  -- entra direto, sem fila); a fila conta só o que sobra para os demais.
  if v_public_capacity < v_capacity then
    v_public_capacity := v_public_capacity - greatest(0, least(3, v_setter_capacity) - v_setters);
  end if;

  -- A fila só vale com a lista cheia: lotada não há o que oferecer, e com 2 ou
  -- mais vagas livres qualquer pessoa pode entrar direto.
  if v_public_capacity - v_confirmed <> 1 then
    return null;
  end if;

  -- Se o que sobra é vaga de levantador, só chama quem é levantador.
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
