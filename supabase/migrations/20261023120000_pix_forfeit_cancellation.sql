-- Desistência simples de quem pagou no Pix: sai da lista sem saldo nem
-- reembolso (o valor fica com o grupo), pra vaga ir pra próxima pessoa da
-- fila de interessados. Só vale até o prazo (20h da véspera, horário de
-- Fortaleza); depois dele segue a desistência fora do prazo que já existe.
--
-- Aditiva: só acrescenta o status 'forfeited' e a escolha 'forfeit' nos
-- checks, e redefine cancel_event_pix_payment a partir da versão de
-- 20261020214901_pix_cancellation_deadline_8pm.sql (mesmo corpo, mais o
-- ramo 'forfeit'). As escolhas 'balance' e 'refund' continuam iguais.

alter table public.event_payment_intents drop constraint event_payment_intents_status_check;
alter table public.event_payment_intents add constraint event_payment_intents_status_check
  check (status = any (array['pending', 'paid', 'expired', 'refund_requested', 'refunded', 'credited', 'cancelled_late', 'transferred', 'void', 'forfeited']));

alter table public.event_payment_intents drop constraint event_payment_intents_cancellation_choice_check;
alter table public.event_payment_intents add constraint event_payment_intents_cancellation_choice_check
  check (cancellation_choice = any (array['refund', 'balance', 'transfer', 'late_cancel', 'forfeit']));

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
  if p_choice not in ('balance', 'refund', 'forfeit') then raise exception 'Escolha de desistência inválida.'; end if;

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

  -- 20h em Fortaleza no dia anterior ao racha.
  v_deadline := (v_event.date::timestamp at time zone 'America/Fortaleza') - interval '1 day' + interval '20 hours';

  if p_choice = 'forfeit' and now() >= v_deadline then
    raise exception 'O prazo para desistir passou (20h da véspera).';
  end if;

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

  if p_choice = 'forfeit' then
    update public.event_payment_intents
    set status = 'forfeited', cancelled_at = now(), cancellation_choice = 'forfeit', updated_at = now()
    where id = v_intent.id;
    return query select 'forfeit'::text, v_deadline;
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
