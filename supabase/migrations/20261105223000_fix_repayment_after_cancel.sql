-- Quem desistia de um Pix pago (reembolso ou saldo) e pagava de novo não era
-- confirmado: o segundo pagamento usa a mesma linha de payments, e o vínculo
-- único de event_payment_intents.payment_id recusava a gravação (erro 23505).
-- Agora o vínculo passa para o pagamento novo e o dinheiro novo entra no caixa.

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
  v_repaid boolean;
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

  -- Quem desistiu e pagou de novo: o pagamento antigo fica no histórico, sem o
  -- vínculo, e o dinheiro novo entra no caixa (o lançamento do trigger é um só por pessoa).
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

      -- Quem desistiu e pagou de novo: o pagamento antigo fica no histórico, sem o
      -- vínculo, e o dinheiro novo entra no caixa (o lançamento do trigger é um só por pessoa).
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
