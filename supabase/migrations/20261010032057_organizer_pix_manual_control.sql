-- Controles manuais para os organizadores resolverem exceções de Pix sem
-- apagar o histórico financeiro ou liberar uma vaga de forma incorreta.

create or replace function public.organizer_resolve_event_pix_payment(
  p_event_id uuid,
  p_profile_id uuid,
  p_choice text
)
returns table (outcome text, cancellation_deadline timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events%rowtype;
  v_intent public.event_payment_intents%rowtype;
  v_deadline timestamptz;
begin
  if not public.is_organizer() then
    raise exception 'Somente organizadores podem resolver desistências Pix.';
  end if;
  if p_choice not in ('balance', 'refund', 'late_cancel') then
    raise exception 'Escolha de desistência inválida.';
  end if;

  select * into v_event from public.events where id = p_event_id for update;
  if not found or v_event.status in ('finished', 'cancelled', 'in_progress') then
    raise exception 'Este racha não aceita mais desistências.';
  end if;

  select i.* into v_intent
  from public.event_payment_intents i
  join public.payments p on p.id = i.payment_id
  where i.event_id = p_event_id
    and i.profile_id = p_profile_id
    and i.status = 'paid'
    and i.provider = 'mercado_pago'
    and p.paid = true
    and p.payment_source = 'pix'
  order by i.paid_at desc nulls last
  limit 1
  for update;
  if not found then
    raise exception 'Nenhum Pix confirmado ativo foi encontrado para esta pessoa.';
  end if;

  v_deadline := (v_event.date::timestamp at time zone 'America/Fortaleza') - interval '1 day';
  if now() >= v_deadline and p_choice <> 'late_cancel' then
    raise exception 'O prazo de saldo ou reembolso já passou. Libere a vaga como desistência fora do prazo.';
  end if;
  if now() < v_deadline and p_choice = 'late_cancel' then
    raise exception 'Antes do prazo, escolha saldo ou pedido de reembolso.';
  end if;

  update public.attendance
  set status = 'declined', cancelled_at = now()
  where event_id = p_event_id and profile_id = p_profile_id and status = 'confirmed';
  if not found then
    raise exception 'A vaga desta pessoa não está confirmada.';
  end if;

  if p_choice = 'balance' then
    insert into public.player_balance_entries (
      profile_id, community, entry_type, amount, category, cash_effect,
      description, event_id, created_by
    ) values (
      p_profile_id, v_event.community, 'credit', v_intent.amount, 'cancellation_credit', 'none',
      'Saldo por desistência avisada de racha pago no Pix', p_event_id, auth.uid()
    );
    update public.event_payment_intents
    set status = 'credited', cancelled_at = now(), cancellation_choice = 'balance', updated_at = now()
    where id = v_intent.id;
    return query select 'balance'::text, v_deadline;
    return;
  end if;

  if p_choice = 'refund' then
    update public.event_payment_intents
    set status = 'refund_requested', cancelled_at = now(), cancellation_choice = 'refund', updated_at = now()
    where id = v_intent.id;
    return query select 'refund_requested'::text, v_deadline;
    return;
  end if;

  update public.event_payment_intents
  set status = 'cancelled_late', cancelled_at = now(), cancellation_choice = 'late_cancel', updated_at = now()
  where id = v_intent.id;
  return query select 'late_cancel'::text, v_deadline;
end;
$$;

revoke all on function public.organizer_resolve_event_pix_payment(uuid, uuid, text) from public, anon;
grant execute on function public.organizer_resolve_event_pix_payment(uuid, uuid, text) to authenticated;

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
  v_event public.events%rowtype;
  v_intent public.event_payment_intents%rowtype;
  v_from_attendance public.attendance%rowtype;
  v_to_attendance public.attendance%rowtype;
  v_regular_confirmed integer;
  v_member_capacity integer;
  v_transfer_id uuid;
begin
  if not public.is_organizer() then
    raise exception 'Somente organizadores podem transferir vagas Pix.';
  end if;
  if p_from_profile_id is null or p_to_profile_id is null or p_from_profile_id = p_to_profile_id then
    raise exception 'Escolha duas pessoas diferentes para a transferência.';
  end if;

  select * into v_event from public.events where id = p_event_id for update;
  if not found or v_event.status in ('finished', 'cancelled', 'in_progress') then
    raise exception 'Este racha não aceita mais transferências de vaga.';
  end if;

  select i.* into v_intent
  from public.event_payment_intents i
  join public.payments p on p.id = i.payment_id
  where i.event_id = p_event_id
    and i.profile_id = p_from_profile_id
    and i.status = 'paid'
    and i.provider = 'mercado_pago'
    and p.paid = true
    and p.payment_source = 'pix'
  order by i.paid_at desc nulls last
  limit 1
  for update;
  if not found then
    raise exception 'Nenhuma vaga Pix confirmada foi encontrada para transferir.';
  end if;

  select * into v_from_attendance from public.attendance
  where event_id = p_event_id and profile_id = p_from_profile_id
  for update;
  if not found or v_from_attendance.status <> 'confirmed' then
    raise exception 'A vaga de origem não está confirmada.';
  end if;

  select * into v_to_attendance from public.attendance
  where event_id = p_event_id and profile_id = p_to_profile_id
  for update;
  if not found or v_to_attendance.status <> 'interested' then
    raise exception 'A pessoa escolhida precisa estar na lista de interessados.';
  end if;

  if v_from_attendance.uses_newcomer_spot and not v_to_attendance.uses_newcomer_spot then
    v_member_capacity := coalesce(v_event.max_players, v_event.num_teams * v_event.team_size) - v_event.newcomer_reserved_spots;
    select count(*)::integer into v_regular_confirmed
    from public.attendance
    where event_id = p_event_id
      and status = 'confirmed'
      and not uses_newcomer_spot
      and profile_id <> p_from_profile_id;
    if v_regular_confirmed >= v_member_capacity then
      raise exception 'Esta vaga está reservada para novato convidado.';
    end if;
  end if;

  update public.attendance
  set status = 'declined', cancelled_at = now()
  where event_id = p_event_id and profile_id = p_from_profile_id;

  update public.attendance
  set status = 'confirmed', confirmed_at = now(), cancelled_at = null
  where event_id = p_event_id and profile_id = p_to_profile_id;

  insert into public.event_payment_transfers (
    payment_intent_id, event_id, from_profile_id, to_profile_id, status, completed_at
  ) values (
    v_intent.id, p_event_id, p_from_profile_id, p_to_profile_id, 'completed', now()
  ) returning id into v_transfer_id;

  update public.event_payment_intents
  set status = 'transferred', cancelled_at = now(), cancellation_choice = 'transfer', updated_at = now()
  where id = v_intent.id;

  return v_transfer_id;
end;
$$;

revoke all on function public.organizer_transfer_event_pix_spot(uuid, uuid, uuid) from public, anon;
grant execute on function public.organizer_transfer_event_pix_spot(uuid, uuid, uuid) to authenticated;