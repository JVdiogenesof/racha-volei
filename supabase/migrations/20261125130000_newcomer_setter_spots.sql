-- Levantadores novatos e "Conta para o ranking".
--
-- newcomer_setter_spots (0, 1 ou 2): das vagas de novato, quantas são de
-- levantador novato. Elas ocupam vagas de levantador (1 por time) e contam
-- dentro das vagas de novato, então o grupo continua com o mesmo total:
--   capacidade C, levantadores S = floor(C/6), novatos N, levantadores novatos K
--   levantadores do grupo: S - K   | jogadores do grupo: C - S - N + K
--   levantadores novatos: K        | jogadores novatos: N - K
-- Levantador novato fica com uses_setter_spot e uses_newcomer_spot = true.
-- Com K = 0 e sem vagas de novato, o comportamento é o mesmo de antes. Com
-- vagas de novato e K = 0, novato levantador entra como novato comum (não
-- ocupa mais vaga de levantador do grupo).
--
-- counts_for_ranking: o organizador escolhe se o racha entra no Índice e nos
-- rankings. Padrão: conta.

alter table public.events add column if not exists newcomer_setter_spots integer not null default 0;
alter table public.events drop constraint if exists events_newcomer_setter_spots_check;
alter table public.events add constraint events_newcomer_setter_spots_check
  check (newcomer_setter_spots between 0 and 2 and newcomer_setter_spots <= newcomer_reserved_spots);
alter table public.events add column if not exists counts_for_ranking boolean not null default true;

-- Quantas vagas de cada tipo estão ocupadas (confirmados + Pix em andamento).
create or replace function public.event_slot_usage(
  p_event_id uuid,
  p_exclude_profile uuid default null,
  p_exclude_intent uuid default null,
  p_include_intents boolean default true
)
returns table(total integer, setters integer, member_setters integer, newcomer_setters integer, newcomer_regulars integer, regulars integer)
language sql
stable
security definer
set search_path = public
as $$
  with rows as (
    select a.uses_setter_spot s, a.uses_newcomer_spot n
    from public.attendance a
    where a.event_id = p_event_id and a.status = 'confirmed'
      and (p_exclude_profile is null or a.profile_id <> p_exclude_profile)
    union all
    select i.uses_setter_spot, i.uses_newcomer_spot
    from public.event_payment_intents i
    where p_include_intents and i.event_id = p_event_id and i.status = 'pending'
      and i.reservation_expires_at > now() and i.reserves_capacity
      and (p_exclude_intent is null or i.id <> p_exclude_intent)
  )
  select count(*)::integer,
         count(*) filter (where s)::integer,
         count(*) filter (where s and not n)::integer,
         count(*) filter (where s and n)::integer,
         count(*) filter (where n and not s)::integer,
         count(*) filter (where not s and not n)::integer
  from rows;
$$;

revoke execute on function public.event_slot_usage(uuid, uuid, uuid, boolean) from public, anon;
grant execute on function public.event_slot_usage(uuid, uuid, uuid, boolean) to authenticated;

-- Cabe mais uma pessoa desse tipo de vaga?
create or replace function public.event_slot_fits(
  p_event public.events, p_setter boolean, p_newcomer boolean,
  p_member_setters integer, p_newcomer_setters integer, p_newcomer_regulars integer, p_regulars integer
)
returns boolean
language sql
stable
set search_path = public
as $$
  with c as (
    select
      coalesce(p_event.max_players, p_event.num_teams * p_event.team_size) as cap,
      greatest(1, floor(coalesce(p_event.max_players, p_event.num_teams * p_event.team_size) / 6.0)::integer) as s,
      coalesce(p_event.newcomer_reserved_spots, 0) as n
  ), k as (
    select c.*, least(coalesce(p_event.newcomer_setter_spots, 0), c.n, c.s) as k from c
  )
  select case
    when p_setter and p_newcomer and k.n > 0 then p_newcomer_setters < k.k
    when p_setter then p_member_setters + greatest(0, p_newcomer_setters - k.k) < k.s - k.k
    when p_newcomer and k.n > 0 then p_newcomer_regulars < k.n - k.k
    else p_regulars + greatest(0, p_newcomer_regulars + p_newcomer_setters - k.n) < k.cap - k.s - k.n + k.k
  end
  from k;
$$;

create or replace function public.begin_event_payment_reservation(p_event_id uuid)
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
  v_public_capacity integer;
  v_setter_capacity integer;
  v_u record;
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
    v_uses_newcomer := v_is_newcomer and (not v_uses_setter or v_event.newcomer_reserved_spots > 0);
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
    select * into v_u from public.event_slot_usage(p_event_id);

    if v_u.total >= v_capacity then
      raise exception 'As vagas deste racha já foram reservadas.';
    end if;

    if v_public_capacity < v_capacity then
      if v_u.total >= v_public_capacity then
        if v_uses_setter and v_u.setters >= least(3, v_setter_capacity) then
          raise exception 'A cota de % levantadores do Lote 1 já foi preenchida e o lote lotou. Você pode entrar na fila de espera como jogador(a) normal ou esperar o Lote 2 (abre em %), que tem vaga guardada para levantador.',
            least(3, v_setter_capacity),
            to_char(v_event.second_batch_opens_at at time zone 'America/Fortaleza', 'DD/MM "às" HH24:MI');
        end if;
        raise exception 'As vagas do Lote 1 já foram preenchidas. O Lote 2 abre em %.',
          to_char(v_event.second_batch_opens_at at time zone 'America/Fortaleza', 'DD/MM "às" HH24:MI');
      end if;
      if not (v_uses_setter and v_u.setters < v_setter_capacity)
         and v_u.total + greatest(0, least(3, v_setter_capacity) - v_u.setters) >= v_public_capacity then
        raise exception 'As vagas restantes do Lote 1 estão guardadas para levantadores. O Lote 2 abre em %.',
          to_char(v_event.second_batch_opens_at at time zone 'America/Fortaleza', 'DD/MM "às" HH24:MI');
      end if;
    end if;

    if exists (
         select 1 from public.spot_offers s
         join public.attendance a on a.event_id = s.event_id and a.profile_id = s.profile_id and a.status = 'interested'
         where s.event_id = p_event_id and s.status = 'pending' and s.expires_at > now()
           and s.profile_id <> v_profile_id
       )
       and (
         (v_public_capacity < v_capacity
           and public.event_lote_blocks_intent(v_event, v_u.total + 1, v_u.setters, v_uses_setter))
         or (v_public_capacity >= v_capacity and v_u.total + 1 >= v_capacity)
       ) then
      raise exception 'Essa vaga está reservada pra próxima pessoa da fila de interessados.';
    end if;

    -- Vaga de levantador cheia (do grupo ou de novato): entra numa vaga comum.
    if v_uses_setter and not public.event_slot_fits(v_event, true, v_uses_newcomer,
         v_u.member_setters, v_u.newcomer_setters, v_u.newcomer_regulars, v_u.regulars) then
      v_uses_setter := false;
      v_uses_newcomer := v_is_newcomer;
    end if;

    if not v_uses_setter and not public.event_slot_fits(v_event, false, v_uses_newcomer,
         v_u.member_setters, v_u.newcomer_setters, v_u.newcomer_regulars, v_u.regulars) then
      if v_uses_newcomer and v_event.newcomer_reserved_spots > 0 then
        raise exception 'As vagas reservadas para novatos convidados já foram preenchidas.';
      end if;
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

create or replace function public.confirm_event_participant(p_event_id uuid, p_profile_id uuid)
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
  u record;
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
  select coalesce((select o.is_setter from public.event_setter_overrides o where o.event_id = p_event_id and o.profile_id = p_profile_id), participant_is_setter) into participant_is_setter;

  is_newcomer := participant_status = 'guest' and participant_guest_event_id = p_event_id;
  if participant_status <> 'approved' and not is_newcomer then
    raise exception 'Essa pessoa precisa ser membro ou estar convidada para este racha.';
  end if;

  capacity := coalesce(event_row.max_players, event_row.num_teams * event_row.team_size);
  uses_setter := coalesce(participant_is_setter, false);
  uses_newcomer := is_newcomer and (not uses_setter or event_row.newcomer_reserved_spots > 0);

  select * into u from public.event_slot_usage(p_event_id, p_profile_id, null, false);

  if u.total >= capacity then
    raise exception 'A lista de confirmados já atingiu o limite de % vagas.', capacity;
  end if;

  if uses_setter and not public.event_slot_fits(event_row, true, uses_newcomer,
       u.member_setters, u.newcomer_setters, u.newcomer_regulars, u.regulars) then
    uses_setter := false;
    uses_newcomer := is_newcomer;
    fell_back := true;
  end if;

  if not uses_setter and not public.event_slot_fits(event_row, false, uses_newcomer,
       u.member_setters, u.newcomer_setters, u.newcomer_regulars, u.regulars) then
    if uses_newcomer and event_row.newcomer_reserved_spots > 0 then
      raise exception 'As vagas reservadas para novatos convidados já foram preenchidas.';
    end if;
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

  if u.total + 1 >= capacity then
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

create or replace function public.advance_spot_offer(p_event_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_event public.events%rowtype;
  v_capacity integer;
  v_public_capacity integer;
  v_confirmed integer;
  v_pending public.spot_offers%rowtype;
  v_next_profile_id uuid;
  v_setter_capacity integer;
  v_u record;
  v_regular_open boolean;
  v_member_setter_open boolean;
  v_newcomer_setter_open boolean;
  v_newcomer_open boolean;
  v_has_newcomer_spots boolean;
  v_lote_active boolean;
begin
  select * into v_event from public.events where id = p_event_id for update;
  if not found or v_event.status in ('finished', 'cancelled') then
    return null;
  end if;

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

  if exists (
    select 1 from public.spot_offers
    where event_id = p_event_id and status = 'pending' and expires_at > now()
  ) then
    return null;
  end if;

  if v_event.status in ('teams_generated', 'in_progress') then
    return null;
  end if;

  v_capacity := coalesce(v_event.max_players, v_event.num_teams * v_event.team_size);
  v_public_capacity := public.event_public_capacity(v_event);
  select * into v_u from public.event_slot_usage(p_event_id, null, null, false);
  v_confirmed := v_u.total;
  v_setter_capacity := greatest(1, floor(v_capacity / 6.0)::integer);

  -- No Lote 1, até 3 vagas ficam guardadas para levantadores (que entram
  -- direto enquanto houver); a fila conta só o que sobra para os demais.
  v_lote_active := v_public_capacity < v_capacity;
  if v_lote_active then
    v_public_capacity := v_public_capacity - greatest(0, least(3, v_setter_capacity) - v_u.setters);
  end if;

  if v_public_capacity - v_confirmed <> 1 then
    return null;
  end if;

  v_has_newcomer_spots := v_event.newcomer_reserved_spots > 0;
  v_regular_open := public.event_slot_fits(v_event, false, false, v_u.member_setters, v_u.newcomer_setters, v_u.newcomer_regulars, v_u.regulars);
  v_member_setter_open := public.event_slot_fits(v_event, true, false, v_u.member_setters, v_u.newcomer_setters, v_u.newcomer_regulars, v_u.regulars);
  v_newcomer_setter_open := v_has_newcomer_spots and public.event_slot_fits(v_event, true, true, v_u.member_setters, v_u.newcomer_setters, v_u.newcomer_regulars, v_u.regulars);
  v_newcomer_open := v_has_newcomer_spots and public.event_slot_fits(v_event, false, true, v_u.member_setters, v_u.newcomer_setters, v_u.newcomer_regulars, v_u.regulars);

  select a.profile_id into v_next_profile_id
    from public.attendance a
    join public.profiles p on p.id = a.profile_id
    cross join lateral (
      select coalesce((select o.is_setter from public.event_setter_overrides o where o.event_id = p_event_id and o.profile_id = a.profile_id), p.is_setter, false) as is_setter,
             (p.status = 'guest' and p.guest_for_event_id = p_event_id) as is_newcomer
    ) x
    where a.event_id = p_event_id and a.status = 'interested'
      and (p.status = 'approved' or x.is_newcomer)
      and not exists (select 1 from public.spot_offers so where so.event_id = p_event_id and so.profile_id = a.profile_id)
      and (
        -- novato (com vagas de novato) só entra nas vagas de novato
        (x.is_newcomer and v_has_newcomer_spots and (v_newcomer_open or (x.is_setter and v_newcomer_setter_open)))
        or (not (x.is_newcomer and v_has_newcomer_spots) and (v_regular_open or (x.is_setter and v_member_setter_open)))
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

create or replace function public.complete_event_pix_payment(p_intent_id uuid, p_provider_order_id text)
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
  v_repaid boolean;
  v_capacity integer;
  v_u record;
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
    select * into v_u from public.event_slot_usage(v_intent.event_id, v_intent.profile_id, v_intent.id, true);

    if v_u.total >= v_capacity
       or not public.event_slot_fits(v_event, v_intent.uses_setter_spot, v_intent.uses_newcomer_spot,
            v_u.member_setters, v_u.newcomer_setters, v_u.newcomer_regulars, v_u.regulars)
       -- Lote 1: o Pix atrasado também respeita o lote.
       or public.event_lote_blocks_intent(v_event, v_u.total, v_u.setters, v_intent.uses_setter_spot) then
      raise exception 'A reserva já expirou e a vaga foi preenchida por outra pessoa.';
    end if;
  end if;

  update public.attendance
  set status = 'confirmed', confirmed_at = now(), cancelled_at = null,
      uses_newcomer_spot = v_intent.uses_newcomer_spot,
      uses_setter_spot = v_intent.uses_setter_spot
  where event_id = v_intent.event_id and profile_id = v_intent.profile_id;
  if not found then raise exception 'A reserva já expirou e a pessoa não possui interesse ativo neste racha.'; end if;

  select exists (
    select 1 from public.payments p
    where p.event_id = v_intent.event_id and p.profile_id = v_intent.profile_id and p.paid and p.payment_source = 'pix'
  ) into v_repaid;

  insert into public.payments (event_id, profile_id, paid, paid_at, marked_by, amount, payment_source, balance_entry_id)
  values (v_intent.event_id, v_intent.profile_id, true, now(), v_event.created_by, v_intent.amount, 'pix', null)
  on conflict (event_id, profile_id) do update set
    paid = true, paid_at = excluded.paid_at, marked_by = excluded.marked_by,
    amount = excluded.amount, payment_source = 'pix', balance_entry_id = null
  returning id into v_payment_id;

  update public.event_payment_intents set payment_id = null
  where payment_id = v_payment_id and id <> v_intent.id;
  if v_repaid then
    insert into public.finance_transactions (
      community, transaction_type, category, description, amount, transaction_date,
      profile_id, event_id, created_by
    ) values (
      v_event.community, 'income', 'event_payment', 'Novo Pix do racha após desistência', v_intent.amount,
      v_event.date, v_intent.profile_id, v_event.id, v_event.created_by
    );
  end if;

  update public.event_payment_intents
  set status = 'paid', payment_id = v_payment_id, paid_at = now(), updated_at = now()
  where id = v_intent.id;

  update public.spot_offers
  set status = 'accepted', resolved_at = now()
  where event_id = v_intent.event_id and profile_id = v_intent.profile_id and status = 'pending';

  return v_payment_id;
end;
$function$;

create or replace function public.credit_late_event_pix_payment(p_intent_id uuid, p_provider_order_id text)
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
  v_u record;
  v_has_room boolean;
  v_repaid boolean;
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
    select * into v_u from public.event_slot_usage(v_intent.event_id, v_intent.profile_id, v_intent.id, true);

    v_has_room := v_u.total < v_capacity
      and public.event_slot_fits(v_event, v_intent.uses_setter_spot, v_intent.uses_newcomer_spot,
            v_u.member_setters, v_u.newcomer_setters, v_u.newcomer_regulars, v_u.regulars)
      and not public.event_lote_blocks_intent(v_event, v_u.total, v_u.setters, v_intent.uses_setter_spot);
  elsif v_event.status not in ('finished', 'cancelled', 'in_progress') and not v_intent.reserves_capacity then
    v_has_room := true;
  end if;

  if v_has_room then
    update public.attendance
    set status = 'confirmed', confirmed_at = now(), cancelled_at = null,
        uses_newcomer_spot = v_intent.uses_newcomer_spot,
        uses_setter_spot = v_intent.uses_setter_spot
    where event_id = v_intent.event_id and profile_id = v_intent.profile_id;

    if found then
      select exists (
        select 1 from public.payments p
        where p.event_id = v_intent.event_id and p.profile_id = v_intent.profile_id and p.paid and p.payment_source = 'pix'
      ) into v_repaid;

      insert into public.payments (event_id, profile_id, paid, paid_at, marked_by, amount, payment_source, balance_entry_id)
      values (v_intent.event_id, v_intent.profile_id, true, now(), v_event.created_by, v_intent.amount, 'pix', null)
      on conflict (event_id, profile_id) do update set
        paid = true, paid_at = excluded.paid_at, marked_by = excluded.marked_by,
        amount = excluded.amount, payment_source = 'pix', balance_entry_id = null
      returning id into v_payment_id;

      update public.event_payment_intents set payment_id = null
      where payment_id = v_payment_id and id <> v_intent.id;
      if v_repaid then
        insert into public.finance_transactions (
          community, transaction_type, category, description, amount, transaction_date,
          profile_id, event_id, created_by
        ) values (
          v_event.community, 'income', 'event_payment', 'Novo Pix do racha após desistência', v_intent.amount,
          v_event.date, v_intent.profile_id, v_event.id, v_event.created_by
        );
      end if;

      update public.event_payment_intents
      set status = 'paid', payment_id = v_payment_id, paid_at = now(), updated_at = now()
      where id = v_intent.id;

      update public.spot_offers
      set status = 'accepted', resolved_at = now()
      where event_id = v_intent.event_id and profile_id = v_intent.profile_id and status = 'pending';

      return v_payment_id;
    end if;
  end if;

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
