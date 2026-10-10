-- Desistências de vagas confirmadas por Pix. O dinheiro já recebido continua
-- registrado no caixa; a escolha define se vira saldo, pedido de reembolso ou
-- receita do racha quando a desistência acontece após o prazo.
create or replace function public.cancel_event_pix_payment(
  p_event_id uuid,
  p_choice text
)
returns table (outcome text, cancellation_deadline timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := auth.uid();
  v_event public.events%rowtype;
  v_intent public.event_payment_intents%rowtype;
  v_deadline timestamptz;
begin
  if v_profile_id is null then raise exception 'Entre na sua conta para desistir.'; end if;
  if p_choice not in ('balance', 'refund') then raise exception 'Escolha de desistência inválida.'; end if;

  select * into v_event from public.events where id = p_event_id for update;
  if not found or v_event.status in ('finished', 'cancelled', 'in_progress') then
    raise exception 'Este racha não aceita mais desistências automáticas.';
  end if;

  select i.* into v_intent
  from public.event_payment_intents i
  join public.payments p on p.id = i.payment_id
  where i.event_id = p_event_id
    and i.profile_id = v_profile_id
    and i.status = 'paid'
    and i.provider = 'mercado_pago'
    and p.paid = true
    and p.payment_source = 'pix'
  order by i.paid_at desc nulls last
  limit 1
  for update;
  if not found then raise exception 'Nenhum pagamento Pix ativo foi encontrado para este racha.'; end if;

  -- 00:00 em Fortaleza no dia anterior ao racha.
  v_deadline := (v_event.date::timestamp at time zone 'America/Fortaleza') - interval '1 day';

  update public.attendance
  set status = 'declined', cancelled_at = now()
  where event_id = p_event_id and profile_id = v_profile_id and status = 'confirmed';
  if not found then raise exception 'Sua vaga não está mais confirmada.'; end if;

  if now() >= v_deadline then
    update public.event_payment_intents
    set status = 'cancelled_late', cancelled_at = now(), cancellation_choice = 'late_cancel', updated_at = now()
    where id = v_intent.id;
    return query select 'late_cancel'::text, v_deadline;
    return;
  end if;

  if p_choice = 'balance' then
    insert into public.player_balance_entries (
      profile_id, community, entry_type, amount, category, cash_effect,
      description, event_id, created_by
    ) values (
      v_profile_id, v_event.community, 'credit', v_intent.amount, 'cancellation_credit', 'none',
      'Saldo por desistência avisada de racha pago no Pix', p_event_id, v_event.created_by
    );
    update public.event_payment_intents
    set status = 'credited', cancelled_at = now(), cancellation_choice = 'balance', updated_at = now()
    where id = v_intent.id;
    return query select 'balance'::text, v_deadline;
  else
    update public.event_payment_intents
    set status = 'refund_requested', cancelled_at = now(), cancellation_choice = 'refund', updated_at = now()
    where id = v_intent.id;
    return query select 'refund_requested'::text, v_deadline;
  end if;
end;
$$;

revoke all on function public.cancel_event_pix_payment(uuid, text) from public, anon;
grant execute on function public.cancel_event_pix_payment(uuid, text) to authenticated;

-- O reembolso é enviado pelos organizadores fora do app. Esta função registra
-- a saída no caixa depois que ela ocorreu e impede duplicidade.
create or replace function public.complete_event_pix_refund(p_intent_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_intent public.event_payment_intents%rowtype;
  v_event public.events%rowtype;
begin
  if not public.is_organizer() then raise exception 'Somente organizadores podem registrar reembolsos.'; end if;
  select * into v_intent from public.event_payment_intents where id = p_intent_id for update;
  if not found or v_intent.status <> 'refund_requested' then raise exception 'Este reembolso não está pendente.'; end if;
  select * into v_event from public.events where id = v_intent.event_id;
  if not found then raise exception 'Racha não encontrado.'; end if;

  insert into public.finance_transactions (
    community, transaction_type, category, description, amount, transaction_date,
    profile_id, event_id, notes, created_by
  ) values (
    v_event.community, 'expense', 'other', 'Reembolso de Pix de racha', v_intent.amount, current_date,
    v_intent.profile_id, v_event.id, 'Pagamento devolvido após desistência avisada.', auth.uid()
  );
  update public.event_payment_intents
  set status = 'refunded', updated_at = now()
  where id = v_intent.id;
end;
$$;

revoke all on function public.complete_event_pix_refund(uuid) from public, anon;
grant execute on function public.complete_event_pix_refund(uuid) to authenticated;
