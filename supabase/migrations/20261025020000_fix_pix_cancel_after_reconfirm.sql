-- Corrige: remover alguém do Pix automático travava com "Nenhum Pix
-- confirmado ativo foi encontrado" quando a pessoa tinha sido removida e
-- reconfirmada depois pelo botão comum (Confirmar/promoteToConfirmed), que
-- só mexe em attendance -- nunca sabe nada sobre event_payment_intents. O
-- intent ficava preso num estado encerrado (cancelled_late/credited/
-- refund_requested) enquanto a pessoa voltava a aparecer confirmada e paga
-- (payments.paid nunca foi resetado -- é histórico de que o valor entrou,
-- não um "ainda vale"). As duas funções de desistência Pix exigiam um
-- intent com status = 'paid' pra funcionar; sem ele, não tinha jeito de
-- tirar a pessoa da lista por ali. Caso real: Erik no racha de domingo
-- (25/10), removido e reconfirmado em menos de 2 minutos.
--
-- Agora a checagem inicial usa a mesma condição que a tela já exige pra
-- mostrar essas opções (attendance confirmado + payments pago no Pix),
-- e o intent mais recente é só usado pra aplicar saldo/reembolso -- se ele
-- já estiver num estado encerrado (a pessoa já passou por uma desistência
-- antes), só tira da lista sem repetir o crédito.

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
  v_payment public.payments%rowtype;
  v_intent public.event_payment_intents%rowtype;
  v_deadline timestamptz;
  v_has_active_intent boolean;
begin
  if v_profile_id is null then raise exception 'Entre na sua conta para desistir.'; end if;
  if p_choice not in ('balance', 'refund', 'forfeit') then raise exception 'Escolha de desistência inválida.'; end if;

  select * into v_event from public.events where id = p_event_id for update;
  if not found or v_event.status in ('finished', 'cancelled', 'in_progress') then
    raise exception 'Este racha não aceita mais desistências automáticas.';
  end if;

  select * into v_payment from public.payments
    where event_id = p_event_id and profile_id = v_profile_id
    and paid = true and payment_source = 'pix'
    for update;
  if not found then raise exception 'Nenhum pagamento Pix ativo foi encontrado para este racha.'; end if;

  select i.* into v_intent
    from public.event_payment_intents i
    where i.event_id = p_event_id and i.profile_id = v_profile_id and i.provider = 'mercado_pago'
    order by i.paid_at desc nulls last, i.created_at desc
    limit 1
    for update;
  v_has_active_intent := found and v_intent.status = 'paid';

  v_deadline := (v_event.date::timestamp at time zone 'America/Fortaleza') - interval '1 day' + interval '20 hours';

  if p_choice = 'forfeit' and now() >= v_deadline then
    raise exception 'O prazo para desistir passou (20h da véspera).';
  end if;

  update public.attendance
  set status = 'declined', cancelled_at = now()
  where event_id = p_event_id and profile_id = v_profile_id and status = 'confirmed';
  if not found then raise exception 'Sua vaga não está mais confirmada.'; end if;

  if not v_has_active_intent then
    return query select 'already_resolved'::text, v_deadline;
    return;
  end if;

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
  v_payment public.payments%rowtype;
  v_intent public.event_payment_intents%rowtype;
  v_deadline timestamptz;
  v_has_active_intent boolean;
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

  select * into v_payment from public.payments
    where event_id = p_event_id and profile_id = p_profile_id
    and paid = true and payment_source = 'pix'
    for update;
  if not found then
    raise exception 'Nenhum Pix confirmado ativo foi encontrado para esta pessoa.';
  end if;

  select i.* into v_intent
    from public.event_payment_intents i
    where i.event_id = p_event_id and i.profile_id = p_profile_id and i.provider = 'mercado_pago'
    order by i.paid_at desc nulls last, i.created_at desc
    limit 1
    for update;
  v_has_active_intent := found and v_intent.status = 'paid';

  v_deadline := (v_event.date::timestamp at time zone 'America/Fortaleza') - interval '1 day' + interval '20 hours';
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

  if not v_has_active_intent then
    return query select 'already_resolved'::text, v_deadline;
    return;
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
