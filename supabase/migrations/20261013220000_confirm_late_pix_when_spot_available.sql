-- Pix pago depois dos 5 minutos de reserva nao deve virar saldo se a pessoa ainda
-- pode ser confirmada. A funcao passa a:
--   * aceitar reservas 'pending' ou 'expired';
--   * se a reserva venceu e ela ocupava vaga, rechecar a lotacao e as cotas
--     (levantadores, novatos, comuns) e confirmar se ainda houver lugar;
--   * se ela ja estava confirmada (vaga garantida, reserves_capacity=false),
--     apenas marcar como pago, sem depender de prazo;
--   * se nao houver mais vaga, manter o erro "reserva ja expirou" para o backend
--     creditar o valor como saldo (o dinheiro nunca se perde).
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
    v_setter_capacity := greatest(1, ceil(v_capacity / 6.0)::integer);

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
       or (not v_intent.uses_setter_spot and not v_intent.uses_newcomer_spot
           and v_confirmed_regulars + v_reserved_regulars >= v_capacity - v_setter_capacity - v_event.newcomer_reserved_spots) then
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
  return v_payment_id;
end;
$$;

revoke all on function public.complete_event_pix_payment(uuid, text) from public, anon, authenticated;
grant execute on function public.complete_event_pix_payment(uuid, text) to service_role;
