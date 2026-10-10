-- Integra o Checkout API do Mercado Pago ao fluxo já existente de reserva.
-- O QR do Mercado Pago fica ativo por ao menos 30 minutos (limite do provedor),
-- mas a vaga continua reservada no VPA por apenas 5 minutos.

alter table public.events
  add column if not exists pix_payment_enabled boolean not null default false;

alter table public.payments
  drop constraint if exists payments_payment_source_check;

alter table public.payments
  add constraint payments_payment_source_check
  check (payment_source in ('cash', 'balance', 'pix'));

-- Um QR pertence a uma intenção e nunca é aceito como confirmação apenas pelo
-- retorno do navegador. O webhook consulta a order no Mercado Pago antes de
-- chamar a função de conclusão abaixo.
alter table public.event_payment_intents
  add column if not exists provider_order_id text;

create unique index if not exists event_payment_intents_provider_order_idx
  on public.event_payment_intents (provider, provider_order_id)
  where provider is not null and provider_order_id is not null;

create or replace function public.attach_event_payment_provider_order(
  p_intent_id uuid,
  p_provider text,
  p_provider_order_id text,
  p_provider_reference text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Entre na sua conta para gerar o Pix.';
  end if;

  if p_provider <> 'mercado_pago' or nullif(trim(p_provider_order_id), '') is null then
    raise exception 'Dados do provedor de pagamento inválidos.';
  end if;

  update public.event_payment_intents
  set provider = p_provider,
      provider_order_id = trim(p_provider_order_id),
      provider_payment_id = trim(p_provider_order_id),
      provider_reference = nullif(trim(p_provider_reference), ''),
      updated_at = now()
  where id = p_intent_id
    and status = 'pending'
    and reservation_expires_at > now()
    and (profile_id = auth.uid() or payer_profile_id = auth.uid())
    and provider_order_id is null;

  if not found then
    raise exception 'A reserva expirou ou o Pix já foi gerado.';
  end if;
end;
$$;

revoke all on function public.attach_event_payment_provider_order(uuid, text, text, text) from public, anon;
grant execute on function public.attach_event_payment_provider_order(uuid, text, text, text) to authenticated;

-- Só o backend (service_role) chama esta função após consultar a order no
-- Mercado Pago e confirmar status=processed/accredited. Ela é idempotente.
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
  select * into v_intent
  from public.event_payment_intents
  where id = p_intent_id
  for update;

  if not found then
    raise exception 'Reserva de pagamento não encontrada.';
  end if;
  if v_intent.provider <> 'mercado_pago' or v_intent.provider_order_id <> trim(p_provider_order_id) then
    raise exception 'A cobrança não corresponde à reserva.';
  end if;
  if v_intent.status = 'paid' then
    return v_intent.payment_id;
  end if;
  if v_intent.status <> 'pending' or v_intent.reservation_expires_at <= now() then
    raise exception 'A reserva já expirou. O pagamento será tratado pelo atendimento.';
  end if;

  select * into v_event from public.events where id = v_intent.event_id for update;
  if not found or v_event.status in ('finished', 'cancelled', 'in_progress') then
    raise exception 'Este racha não aceita mais confirmação automática.';
  end if;

  -- A própria reserva já ocupava essa vaga. A conversão para confirmado não
  -- aumenta a ocupação e não permite ultrapassar o limite do racha.
  update public.attendance
  set status = 'confirmed', confirmed_at = now(), cancelled_at = null,
      uses_newcomer_spot = v_intent.uses_newcomer_spot
  where event_id = v_intent.event_id and profile_id = v_intent.profile_id;

  if not found then
    raise exception 'A pessoa não possui interesse ativo neste racha.';
  end if;

  insert into public.payments (
    event_id, profile_id, paid, paid_at, marked_by, amount, payment_source, balance_entry_id
  ) values (
    v_intent.event_id, v_intent.profile_id, true, now(), v_event.created_by,
    v_intent.amount, 'pix', null
  )
  on conflict (event_id, profile_id) do update set
    paid = true,
    paid_at = excluded.paid_at,
    marked_by = excluded.marked_by,
    amount = excluded.amount,
    payment_source = 'pix',
    balance_entry_id = null
  returning id into v_payment_id;

  update public.event_payment_intents
  set status = 'paid', payment_id = v_payment_id, paid_at = now(), updated_at = now()
  where id = v_intent.id;

  return v_payment_id;
end;
$$;

revoke all on function public.complete_event_pix_payment(uuid, text) from public, anon, authenticated;
grant execute on function public.complete_event_pix_payment(uuid, text) to service_role;

-- Se alguém concluir o Pix após os cinco minutos, o dinheiro não some nem
-- volta a ocupar uma vaga já liberada: vira saldo da própria pessoa.
create or replace function public.credit_late_event_pix_payment(
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
  v_entry_id uuid;
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

  select * into v_event from public.events where id = v_intent.event_id;
  if not found then raise exception 'Racha não encontrado.'; end if;

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
$$;

revoke all on function public.credit_late_event_pix_payment(uuid, text) from public, anon, authenticated;
grant execute on function public.credit_late_event_pix_payment(uuid, text) to service_role;

-- Pix é entrada real no mesmo caixa dos pagamentos presenciais. Saldos seguem
-- fora da entrada de caixa, pois apenas compensam crédito já existente.
create or replace function public.sync_payment_finance_transaction()
returns trigger language plpgsql security invoker set search_path = public as $$
declare v_event public.events%rowtype;
begin
  if new.paid and new.payment_source in ('cash', 'pix') and new.amount is not null and new.amount > 0 then
    select * into v_event from public.events where id = new.event_id;
    insert into public.finance_transactions (
      community, transaction_type, category, description, amount, transaction_date,
      profile_id, event_id, payment_id, created_by, voided_at, voided_by
    ) values (
      v_event.community, 'income', 'event_payment',
      case when new.payment_source = 'pix' then 'Pagamento Pix do racha' else 'Pagamento do racha' end,
      new.amount, v_event.date, new.profile_id, new.event_id, new.id,
      coalesce(new.marked_by, v_event.created_by), null, null
    )
    on conflict (payment_id) do update set
      amount = excluded.amount,
      description = excluded.description,
      transaction_date = excluded.transaction_date,
      created_by = excluded.created_by,
      voided_at = null,
      voided_by = null;
  else
    update public.finance_transactions
      set voided_at = coalesce(voided_at, now()), voided_by = coalesce(voided_by, auth.uid())
      where payment_id = new.id and voided_at is null;
  end if;
  return new;
end;
$$;

-- Pagamentos automáticos podem reservar na fase de interesse, mantendo a lista
-- pública sob decisão do organizador.
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
  v_attendance_status public.attendance_status;
  v_existing public.event_payment_intents%rowtype;
  v_capacity integer;
  v_confirmed_total integer;
  v_confirmed_regulars integer;
  v_reserved_total integer;
  v_reserved_regulars integer;
  v_is_newcomer boolean;
  v_reserves_capacity boolean;
begin
  if v_profile_id is null then
    raise exception 'Entre na sua conta para reservar uma vaga.';
  end if;

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

  select status, guest_for_event_id into v_profile_status, v_guest_for_event_id
  from public.profiles where id = v_profile_id;
  if not found then raise exception 'Perfil não encontrado.'; end if;
  v_is_newcomer := v_profile_status = 'guest' and v_guest_for_event_id = p_event_id;
  if v_profile_status <> 'approved' and not v_is_newcomer then
    raise exception 'Você precisa estar autorizado para reservar uma vaga.';
  end if;

  select status into v_attendance_status
  from public.attendance
  where event_id = p_event_id and profile_id = v_profile_id;
  if v_attendance_status not in ('interested', 'confirmed') then
    raise exception 'Demonstre interesse neste racha antes de reservar a vaga.';
  end if;

  -- Qualquer reserva vencida deixa de ocupar vaga antes da nova contagem.
  update public.event_payment_intents
  set status = 'expired', updated_at = now()
  where event_id = p_event_id
    and status = 'pending'
    and reservation_expires_at <= now();

  select * into v_existing
  from public.event_payment_intents
  where event_id = p_event_id
    and profile_id = v_profile_id
    and status in ('pending', 'paid')
  order by created_at desc
  limit 1;

  if found then
    if v_existing.status = 'paid' then
      raise exception 'Este racha já está pago para esta pessoa.';
    end if;
    return query select v_existing.id, v_existing.amount, v_existing.reservation_expires_at;
    return;
  end if;

  v_reserves_capacity := v_attendance_status <> 'confirmed';
  v_capacity := coalesce(v_event.max_players, v_event.num_teams * v_event.team_size);

  if v_reserves_capacity then
    select
      count(*)::integer,
      count(*) filter (where not uses_newcomer_spot)::integer
    into v_confirmed_total, v_confirmed_regulars
    from public.attendance
    where event_id = p_event_id and status = 'confirmed';

    select
      count(*)::integer,
      count(*) filter (where not uses_newcomer_spot)::integer
    into v_reserved_total, v_reserved_regulars
    from public.event_payment_intents
    where event_id = p_event_id
      and status = 'pending'
      and reservation_expires_at > now()
      and reserves_capacity;

    if v_confirmed_total + v_reserved_total >= v_capacity then
      raise exception 'As vagas deste racha já foram reservadas.';
    end if;

    if not v_is_newcomer
      and v_confirmed_regulars + v_reserved_regulars >= v_capacity - v_event.newcomer_reserved_spots then
      raise exception 'As vagas restantes estão protegidas para novatos convidados.';
    end if;
  end if;

  return query
  insert into public.event_payment_intents (
    event_id, profile_id, payer_profile_id, amount, status, reservation_expires_at,
    reserves_capacity, uses_newcomer_spot
  ) values (
    p_event_id, v_profile_id, v_profile_id, v_event.price_per_player, 'pending',
    now() + interval '5 minutes', v_reserves_capacity, v_is_newcomer
  )
  returning id, amount, reservation_expires_at;
end;
$$;


revoke all on function public.begin_event_payment_reservation(uuid) from public, anon;
grant execute on function public.begin_event_payment_reservation(uuid) to authenticated;

