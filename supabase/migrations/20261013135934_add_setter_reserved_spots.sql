-- Reserva automática de levantadores para listas com pagamento Pix.
-- A proporção é de uma vaga para levantador a cada seis vagas do racha:
-- 24 vagas = 4 levantadores; 18 vagas = 3 levantadores.

alter table public.attendance
  add column if not exists uses_setter_spot boolean not null default false;

alter table public.event_payment_intents
  add column if not exists uses_setter_spot boolean not null default false;

-- Mantém a leitura das listas antigas coerente, sem alterar presença nem pagamento.
update public.attendance a
set uses_setter_spot = true,
    uses_newcomer_spot = false
from public.profiles p
where p.id = a.profile_id
  and a.status = 'confirmed'
  and p.is_setter = true;

-- Confirmação manual, uso de saldo e chamadas de convidados passam pela mesma
-- divisão: levantador ocupa apenas a vaga de levantador; os demais não ocupam
-- essa cota. A linha do evento fica bloqueada durante a decisão.
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

  if uses_setter then
    if confirmed_setters >= setter_capacity then
      raise exception 'As % vagas reservadas para levantadores já foram preenchidas.', setter_capacity;
    end if;
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
end;
$$;

-- A reserva Pix segura a categoria certa por cinco minutos. Isso evita que
-- várias pessoas ocupem a última vaga de levantador ao mesmo tempo.
create or replace function public.begin_event_payment_reservation(p_event_id uuid)
returns table (payment_intent_id uuid, amount numeric, reservation_expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
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

  select * into v_event from public.events where id = p_event_id for update;
  if not found then raise exception 'Racha não encontrado.'; end if;
  if v_event.status in ('finished', 'cancelled', 'in_progress') then
    raise exception 'Esse racha não aceita pagamentos neste momento.';
  end if;
  if not v_event.pix_payment_enabled then
    raise exception 'O pagamento automático ainda não está ativo neste racha.';
  end if;
  if v_event.registration_opens_at is not null and v_event.registration_opens_at > now() then
    raise exception 'As inscrições deste racha ainda não estão abertas.';
  end if;
  if v_event.price_per_player is null or v_event.price_per_player <= 0 then
    raise exception 'Este racha ainda não possui valor para pagamento.';
  end if;

  select status, guest_for_event_id, is_setter
  into v_profile_status, v_guest_for_event_id, v_profile_is_setter
  from public.profiles where id = v_profile_id;
  if not found then raise exception 'Perfil não encontrado.'; end if;

  v_is_newcomer := v_profile_status = 'guest' and v_guest_for_event_id = p_event_id;
  if v_profile_status <> 'approved' and not v_is_newcomer then
    raise exception 'Você precisa estar autorizado para reservar uma vaga.';
  end if;
  v_uses_setter := coalesce(v_profile_is_setter, false);
  v_uses_newcomer := v_is_newcomer and not v_uses_setter;

  select status into v_attendance_status
  from public.attendance where event_id = p_event_id and profile_id = v_profile_id;
  if v_attendance_status not in ('interested', 'confirmed') then
    raise exception 'Demonstre interesse neste racha antes de reservar a vaga.';
  end if;

  update public.event_payment_intents
  set status = 'expired', updated_at = now()
  where event_id = p_event_id and status = 'pending' and reservation_expires_at <= now();

  select * into v_existing
  from public.event_payment_intents
  where event_id = p_event_id and profile_id = v_profile_id and status in ('pending', 'paid')
  order by created_at desc limit 1;
  if found then
    if v_existing.status = 'paid' then raise exception 'Este racha já está pago para esta pessoa.'; end if;
    return query select v_existing.id, v_existing.amount, v_existing.reservation_expires_at;
    return;
  end if;

  v_reserves_capacity := v_attendance_status <> 'confirmed';
  v_capacity := coalesce(v_event.max_players, v_event.num_teams * v_event.team_size);
  v_setter_capacity := greatest(1, ceil(v_capacity / 6.0)::integer);

  if v_reserves_capacity then
    select
      count(*)::integer,
      count(*) filter (where uses_setter_spot)::integer,
      count(*) filter (where uses_newcomer_spot)::integer,
      count(*) filter (where not uses_setter_spot and not uses_newcomer_spot)::integer
    into v_confirmed_total, v_confirmed_setters, v_confirmed_newcomers, v_confirmed_regulars
    from public.attendance where event_id = p_event_id and status = 'confirmed';

    select
      count(*)::integer,
      count(*) filter (where uses_setter_spot)::integer,
      count(*) filter (where uses_newcomer_spot)::integer,
      count(*) filter (where not uses_setter_spot and not uses_newcomer_spot)::integer
    into v_reserved_total, v_reserved_setters, v_reserved_newcomers, v_reserved_regulars
    from public.event_payment_intents
    where event_id = p_event_id and status = 'pending' and reservation_expires_at > now() and reserves_capacity;

    if v_confirmed_total + v_reserved_total >= v_capacity then
      raise exception 'As vagas deste racha já foram reservadas.';
    end if;
    if v_uses_setter then
      if v_confirmed_setters + v_reserved_setters >= v_setter_capacity then
        raise exception 'As % vagas reservadas para levantadores já foram preenchidas. Não gere Pix: espere uma vaga de levantador ser liberada.', v_setter_capacity;
      end if;
    elsif v_uses_newcomer and v_event.newcomer_reserved_spots > 0 then
      if v_confirmed_newcomers + v_reserved_newcomers >= v_event.newcomer_reserved_spots then
        raise exception 'As vagas reservadas para novatos convidados já foram preenchidas.';
      end if;
    elsif v_confirmed_regulars + v_reserved_regulars >= v_capacity - v_setter_capacity - v_event.newcomer_reserved_spots then
      raise exception 'As vagas comuns já foram preenchidas. As restantes são exclusivas para levantadores ou novatos convidados.';
    end if;
  end if;

  return query
  insert into public.event_payment_intents (
    event_id, profile_id, payer_profile_id, amount, status, reservation_expires_at,
    reserves_capacity, uses_newcomer_spot, uses_setter_spot
  ) values (
    p_event_id, v_profile_id, v_profile_id, v_event.price_per_player, 'pending', now() + interval '5 minutes',
    v_reserves_capacity, v_uses_newcomer, v_uses_setter
  ) returning id, amount, reservation_expires_at;
end;
$$;

-- A confirmação do webhook preserva a categoria que já estava bloqueada pelo
-- Pix; não recálcula a função da pessoa no meio do pagamento.
create or replace function public.complete_event_pix_payment(
  p_intent_id uuid,
  p_provider_order_id text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_intent public.event_payment_intents%rowtype;
  v_event public.events%rowtype;
  v_payment_id uuid;
begin
  select * into v_intent from public.event_payment_intents where id = p_intent_id for update;
  if not found then raise exception 'Reserva de pagamento não encontrada.'; end if;
  if v_intent.provider <> 'mercado_pago' or v_intent.provider_order_id <> trim(p_provider_order_id) then
    raise exception 'A cobrança não corresponde à reserva.';
  end if;
  if v_intent.status = 'paid' then return v_intent.payment_id; end if;
  if v_intent.status <> 'pending' or v_intent.reservation_expires_at <= now() then
    raise exception 'A reserva já expirou. O pagamento será tratado pelo atendimento.';
  end if;

  select * into v_event from public.events where id = v_intent.event_id for update;
  if not found or v_event.status in ('finished', 'cancelled', 'in_progress') then
    raise exception 'Este racha não aceita mais confirmação automática.';
  end if;

  update public.attendance
  set status = 'confirmed', confirmed_at = now(), cancelled_at = null,
      uses_newcomer_spot = v_intent.uses_newcomer_spot,
      uses_setter_spot = v_intent.uses_setter_spot
  where event_id = v_intent.event_id and profile_id = v_intent.profile_id;
  if not found then raise exception 'A pessoa não possui interesse ativo neste racha.'; end if;

  insert into public.payments (event_id, profile_id, paid, paid_at, marked_by, amount, payment_source, balance_entry_id)
  values (v_intent.event_id, v_intent.profile_id, true, now(), v_event.created_by, v_intent.amount, 'pix', null)
  on conflict (event_id, profile_id) do update set
    paid = true, paid_at = excluded.paid_at, marked_by = excluded.marked_by,
    amount = excluded.amount, payment_source = 'pix', balance_entry_id = null
  returning id into v_payment_id;

  update public.event_payment_intents
  set status = 'paid', payment_id = v_payment_id, paid_at = now(), updated_at = now()
  where id = v_intent.id;
  return v_payment_id;
end;
$$;

-- Uma vaga transferida mantém sua categoria. Assim uma vaga de levantador só
-- pode ser transferida para outro levantador, e uma vaga comum não fura essa cota.
create or replace function public.transfer_event_pix_spot(p_event_id uuid, p_to_profile_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_from_profile_id uuid := auth.uid();
  v_intent public.event_payment_intents%rowtype;
  v_from_attendance public.attendance%rowtype;
  v_to_attendance public.attendance%rowtype;
  v_to_is_setter boolean;
  v_transfer_id uuid;
begin
  if v_from_profile_id is null then raise exception 'Entre na sua conta para transferir a vaga.'; end if;
  if p_to_profile_id is null or p_to_profile_id = v_from_profile_id then raise exception 'Escolha outra pessoa para receber a vaga.'; end if;

  perform 1 from public.events where id = p_event_id and status not in ('finished', 'cancelled', 'in_progress') for update;
  if not found then raise exception 'Este racha não aceita mais transferências de vaga.'; end if;

  select i.* into v_intent from public.event_payment_intents i join public.payments p on p.id = i.payment_id
  where i.event_id = p_event_id and i.profile_id = v_from_profile_id and i.status = 'paid' and i.provider = 'mercado_pago' and p.paid and p.payment_source = 'pix'
  order by i.paid_at desc nulls last limit 1 for update;
  if not found then raise exception 'Nenhuma vaga Pix confirmada foi encontrada para transferir.'; end if;

  select * into v_from_attendance from public.attendance where event_id = p_event_id and profile_id = v_from_profile_id for update;
  if not found or v_from_attendance.status <> 'confirmed' then raise exception 'Sua vaga não está confirmada para transferência.'; end if;
  select * into v_to_attendance from public.attendance where event_id = p_event_id and profile_id = p_to_profile_id for update;
  if not found or v_to_attendance.status <> 'interested' then raise exception 'A pessoa escolhida precisa estar na lista de interessados.'; end if;
  select is_setter into v_to_is_setter from public.profiles where id = p_to_profile_id;
  if coalesce(v_to_is_setter, false) <> v_from_attendance.uses_setter_spot then
    raise exception 'A vaga de levantador só pode ser transferida para outro levantador, e uma vaga comum para quem não é levantador.';
  end if;

  update public.attendance set status = 'declined', cancelled_at = now() where event_id = p_event_id and profile_id = v_from_profile_id;
  update public.attendance set status = 'confirmed', confirmed_at = now(), cancelled_at = null,
    uses_newcomer_spot = v_from_attendance.uses_newcomer_spot,
    uses_setter_spot = v_from_attendance.uses_setter_spot
  where event_id = p_event_id and profile_id = p_to_profile_id;

  insert into public.event_payment_transfers (payment_intent_id, event_id, from_profile_id, to_profile_id, status, completed_at)
  values (v_intent.id, p_event_id, v_from_profile_id, p_to_profile_id, 'completed', now()) returning id into v_transfer_id;
  update public.event_payment_intents set status = 'transferred', cancelled_at = now(), cancellation_choice = 'transfer', updated_at = now() where id = v_intent.id;
  return v_transfer_id;
end;
$$;

create or replace function public.organizer_transfer_event_pix_spot(
  p_event_id uuid,
  p_from_profile_id uuid,
  p_to_profile_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_intent public.event_payment_intents%rowtype;
  v_from_attendance public.attendance%rowtype;
  v_to_attendance public.attendance%rowtype;
  v_to_is_setter boolean;
  v_transfer_id uuid;
begin
  if not public.is_organizer() then raise exception 'Somente organizadores podem transferir vagas Pix.'; end if;
  if p_from_profile_id is null or p_to_profile_id is null or p_from_profile_id = p_to_profile_id then raise exception 'Escolha duas pessoas diferentes para a transferência.'; end if;

  perform 1 from public.events where id = p_event_id and status not in ('finished', 'cancelled', 'in_progress') for update;
  if not found then raise exception 'Este racha não aceita mais transferências de vaga.'; end if;

  select i.* into v_intent from public.event_payment_intents i join public.payments p on p.id = i.payment_id
  where i.event_id = p_event_id and i.profile_id = p_from_profile_id and i.status = 'paid' and i.provider = 'mercado_pago' and p.paid and p.payment_source = 'pix'
  order by i.paid_at desc nulls last limit 1 for update;
  if not found then raise exception 'Nenhuma vaga Pix confirmada foi encontrada para transferir.'; end if;

  select * into v_from_attendance from public.attendance where event_id = p_event_id and profile_id = p_from_profile_id for update;
  if not found or v_from_attendance.status <> 'confirmed' then raise exception 'A vaga de origem não está confirmada.'; end if;
  select * into v_to_attendance from public.attendance where event_id = p_event_id and profile_id = p_to_profile_id for update;
  if not found or v_to_attendance.status <> 'interested' then raise exception 'A pessoa escolhida precisa estar na lista de interessados.'; end if;
  select is_setter into v_to_is_setter from public.profiles where id = p_to_profile_id;
  if coalesce(v_to_is_setter, false) <> v_from_attendance.uses_setter_spot then
    raise exception 'A vaga de levantador só pode ser transferida para outro levantador, e uma vaga comum para quem não é levantador.';
  end if;

  update public.attendance set status = 'declined', cancelled_at = now() where event_id = p_event_id and profile_id = p_from_profile_id;
  update public.attendance set status = 'confirmed', confirmed_at = now(), cancelled_at = null,
    uses_newcomer_spot = v_from_attendance.uses_newcomer_spot,
    uses_setter_spot = v_from_attendance.uses_setter_spot
  where event_id = p_event_id and profile_id = p_to_profile_id;

  insert into public.event_payment_transfers (payment_intent_id, event_id, from_profile_id, to_profile_id, status, completed_at)
  values (v_intent.id, p_event_id, p_from_profile_id, p_to_profile_id, 'completed', now()) returning id into v_transfer_id;
  update public.event_payment_intents set status = 'transferred', cancelled_at = now(), cancellation_choice = 'transfer', updated_at = now() where id = v_intent.id;
  return v_transfer_id;
end;
$$;
