-- Revisão do fluxo completo de pagamento com lotes:
-- 1) Pix pago depois dos 5 min da reserva (o código vale 30 min) agora segue
--    as regras do lote: só confirma se couber no Lote 1 (sem tomar as vagas
--    guardadas para levantadores); senão vira saldo, como já era com a lista cheia.
-- 2) A vaga guardada para quem a fila chamou passa a ser protegida no banco.
-- Regras centralizadas em event_lote_blocks_intent.

-- Uma vaga a mais (sobre p_taken já ocupadas, p_setters delas de levantador)
-- fere as regras do Lote 1? Ninguém passa do total do lote; levantador com
-- vaga de levantador sobrando pode usar as vagas guardadas; os demais deixam
-- até 3 guardadas para levantadores. Fora do Lote 1 (ou sem lotes): false,
-- e valem só as regras normais de capacidade.
create or replace function public.event_lote_blocks_intent(
  p_event public.events,
  p_taken integer,
  p_setters integer,
  p_uses_setter boolean
)
returns boolean
language sql
stable
set search_path to 'public'
as $function$
  with c as (
    select
      coalesce(p_event.max_players, p_event.num_teams * p_event.team_size) as capacity,
      public.event_public_capacity(p_event) as public_capacity,
      greatest(1, floor(coalesce(p_event.max_players, p_event.num_teams * p_event.team_size) / 6.0)::integer) as setter_capacity
  )
  select case
    when c.public_capacity >= c.capacity then false
    when p_taken >= c.public_capacity then true
    when p_uses_setter and p_setters < c.setter_capacity then false
    else p_taken + greatest(0, least(3, c.setter_capacity) - p_setters) >= c.public_capacity
  end
  from c;
$function$;

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

    -- Lote 1: ninguém passa do total do lote. Levantador (com vaga de
    -- levantador sobrando) usa qualquer vaga livre do lote, inclusive as
    -- guardadas. Os demais deixam guardadas até 3 vagas para levantadores
    -- enquanto eles não chegarem; o que faltar fica para o Lote 2.
    if v_public_capacity < v_capacity then
      if v_confirmed_total + v_reserved_total >= v_public_capacity then
        if v_uses_setter and v_confirmed_setters + v_reserved_setters >= least(3, v_setter_capacity) then
          raise exception 'A cota de % levantadores do Lote 1 já foi preenchida e o lote lotou. Você pode entrar na fila de espera como jogador(a) normal ou esperar o Lote 2 (abre em %), que tem vaga guardada para levantador.',
            least(3, v_setter_capacity),
            to_char(v_event.second_batch_opens_at at time zone 'America/Fortaleza', 'DD/MM "às" HH24:MI');
        end if;
        raise exception 'As vagas do Lote 1 já foram preenchidas. O Lote 2 abre em %.',
          to_char(v_event.second_batch_opens_at at time zone 'America/Fortaleza', 'DD/MM "às" HH24:MI');
      end if;
      if not (v_uses_setter and v_confirmed_setters + v_reserved_setters < v_setter_capacity)
         and v_confirmed_total + v_reserved_total
           + greatest(0, least(3, v_setter_capacity) - v_confirmed_setters - v_reserved_setters) >= v_public_capacity then
        raise exception 'As vagas restantes do Lote 1 estão guardadas para levantadores. O Lote 2 abre em %.',
          to_char(v_event.second_batch_opens_at at time zone 'America/Fortaleza', 'DD/MM "às" HH24:MI');
      end if;
    end if;

    -- A última vaga liberada fica guardada para quem a fila chamou (1h): outra
    -- pessoa não reserva nesse meio tempo (antes só a tela impedia).
    if exists (
         select 1 from public.spot_offers s
         join public.attendance a on a.event_id = s.event_id and a.profile_id = s.profile_id and a.status = 'interested'
         where s.event_id = p_event_id and s.status = 'pending' and s.expires_at > now()
           and s.profile_id <> v_profile_id
       )
       -- Só sobra (para esta pessoa) a vaga que está guardada para a fila?
       and (
         (v_public_capacity < v_capacity
           and public.event_lote_blocks_intent(v_event, v_confirmed_total + v_reserved_total + 1,
                 v_confirmed_setters + v_reserved_setters, v_uses_setter))
         or (v_public_capacity >= v_capacity and v_confirmed_total + v_reserved_total + 1 >= v_capacity)
       ) then
      raise exception 'Essa vaga está reservada pra próxima pessoa da fila de interessados.';
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

create or replace function public.complete_event_pix_payment(p_intent_id uuid, p_provider_order_id text)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
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
           and v_confirmed_regulars + v_reserved_regulars + greatest(0, v_confirmed_newcomers + v_reserved_newcomers - v_event.newcomer_reserved_spots) >= v_capacity - v_setter_capacity - v_event.newcomer_reserved_spots)
       -- Lote 1: o Pix atrasado também respeita o lote.
       or public.event_lote_blocks_intent(v_event, v_confirmed_total + v_reserved_total,
            v_confirmed_setters + v_reserved_setters, v_intent.uses_setter_spot) then
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

create or replace function public.credit_late_event_pix_payment(p_intent_id uuid, p_provider_order_id text)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
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
               and v_confirmed_regulars + v_reserved_regulars + greatest(0, v_confirmed_newcomers + v_reserved_newcomers - v_event.newcomer_reserved_spots) >= v_capacity - v_setter_capacity - v_event.newcomer_reserved_spots)
      -- Lote 1: o Pix atrasado também respeita o lote.
      and not public.event_lote_blocks_intent(v_event, v_confirmed_total + v_reserved_total,
                v_confirmed_setters + v_reserved_setters, v_intent.uses_setter_spot);
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

-- Funções auxiliares: só usadas dentro das funções do banco.
revoke execute on function public.event_lote_blocks_intent(public.events, integer, integer, boolean) from public, anon;
revoke execute on function public.event_public_capacity(public.events) from public, anon;
