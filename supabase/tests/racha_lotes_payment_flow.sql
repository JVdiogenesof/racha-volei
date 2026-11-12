-- Fluxo de inscrição e pagamento Pix com lotes de vagas.
-- Roda tudo num racha de teste criado aqui e SEMPRE termina com erro, para o
-- banco desfazer tudo (nada fica gravado). Resultado esperado:
--   ERROR: TODOS OS TESTES PASSARAM: ...
-- Qualquer outra mensagem começando com "TESTE FALHOU" aponta o problema.
do $$
declare
  creator uuid;
  ev uuid;
  ev_plain uuid;
  regs uuid[];
  setters uuid[];
  r uuid;
  i integer;
  intent uuid;
  msg text;
  log text := '';
  offered uuid;
  paid_count integer;

  -- Pool de jogadores aprovados do vôlei de quadra (sem tocar no que é deles:
  -- todos os registros criados aqui são do racha de teste e são desfeitos).
begin
  select id into creator from public.profiles where is_organizer and status = 'approved' order by full_name limit 1;
  select array_agg(id) into regs from (
    select id from public.profiles
    where status = 'approved' and not is_setter and 'court' = any(communities)
    order by id limit 22) x;
  select array_agg(id) into setters from (
    select id from public.profiles
    where status = 'approved' and is_setter and 'court' = any(communities)
    order by id limit 5) x;
  if coalesce(array_length(regs, 1), 0) < 22 or coalesce(array_length(setters, 1), 0) < 5 then
    raise exception 'TESTE FALHOU: jogadores insuficientes para o teste (% comuns, % levantadores)',
      array_length(regs, 1), array_length(setters, 1);
  end if;

  ------------------------------------------------------------------
  -- 1) Antes da lista abrir ninguém reserva.
  ------------------------------------------------------------------
  insert into public.events (date, time, num_teams, team_size, max_players, pix_payment_enabled, price_per_player,
    community, status, official_list_open, created_by, first_batch_spots, second_batch_opens_at,
    registration_opens_at, newcomer_reserved_spots)
  values (current_date + 5, '10:00', 4, 6, 24, true, 10, 'court', 'open', true, creator,
    18, now() + interval '1 day', now() + interval '1 hour', 0)
  returning id into ev;
  insert into public.attendance (event_id, profile_id, status) values (ev, regs[1], 'interested');
  perform set_config('request.jwt.claims', json_build_object('sub', regs[1], 'role', 'authenticated')::text, true);
  begin
    perform * from public.begin_event_payment_reservation(ev);
    raise exception 'TESTE FALHOU: reservou antes da lista abrir';
  exception when others then
    if sqlerrm not like 'As inscrições deste racha ainda não estão abertas%' then raise; end if;
  end;
  log := log || '1 ok; ';

  -- Lista aberta (Lote 1).
  update public.events set registration_opens_at = now() - interval '1 minute' where id = ev;

  ------------------------------------------------------------------
  -- 2) Reserva + Pix pago dentro do prazo confirma e marca como pago.
  ------------------------------------------------------------------
  select payment_intent_id into intent from public.begin_event_payment_reservation(ev);
  update public.event_payment_intents set provider = 'mercado_pago', provider_order_id = 'TESTE-2' where id = intent;
  perform public.complete_event_pix_payment(intent, 'TESTE-2');
  if not exists (select 1 from public.attendance where event_id = ev and profile_id = regs[1] and status = 'confirmed')
     or not exists (select 1 from public.payments where event_id = ev and profile_id = regs[1] and paid) then
    raise exception 'TESTE FALHOU: Pix no prazo não confirmou/pagou';
  end if;
  log := log || '2 ok; ';

  ------------------------------------------------------------------
  -- 3) Lote 1: 15 comuns no máximo enquanto não houver 3 levantadores.
  ------------------------------------------------------------------
  insert into public.attendance (event_id, profile_id, status)
    select ev, regs[k], 'confirmed' from generate_series(2, 15) k;  -- 15 comuns confirmados
  insert into public.attendance (event_id, profile_id, status)
    select ev, regs[k], 'interested' from generate_series(16, 22) k;
  insert into public.attendance (event_id, profile_id, status)
    select ev, setters[k], 'interested' from generate_series(1, 5) k;
  perform set_config('request.jwt.claims', json_build_object('sub', regs[16], 'role', 'authenticated')::text, true);
  begin
    perform * from public.begin_event_payment_reservation(ev);
    raise exception 'TESTE FALHOU: 16º comum entrou no Lote 1';
  exception when others then
    if sqlerrm not like 'As vagas restantes do Lote 1 estão guardadas para levantadores%' then raise; end if;
  end;
  log := log || '3 ok; ';

  ------------------------------------------------------------------
  -- 4) 3 levantadores entram; com o lote cheio o 4º recebe o aviso da cota.
  ------------------------------------------------------------------
  for i in 1..3 loop
    perform set_config('request.jwt.claims', json_build_object('sub', setters[i], 'role', 'authenticated')::text, true);
    select payment_intent_id into intent from public.begin_event_payment_reservation(ev);
    if not (select uses_setter_spot from public.event_payment_intents where id = intent) then
      raise exception 'TESTE FALHOU: levantador % não ficou na vaga de levantador', i;
    end if;
  end loop;
  perform set_config('request.jwt.claims', json_build_object('sub', setters[4], 'role', 'authenticated')::text, true);
  begin
    perform * from public.begin_event_payment_reservation(ev);
    raise exception 'TESTE FALHOU: 4º levantador passou do Lote 1';
  exception when others then
    if sqlerrm not like 'A cota de 3 levantadores do Lote 1 já foi preenchida%' then raise; end if;
  end;
  log := log || '4 ok; ';

  ------------------------------------------------------------------
  -- 5) Pix atrasado (reserva de 5 min venceu) com o lote cheio vira saldo,
  --    e não passa do Lote 1.
  ------------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', setters[1], 'role', 'authenticated')::text, true);
  select id into intent from public.event_payment_intents where event_id = ev and profile_id = setters[1] and status = 'pending';
  update public.event_payment_intents
    set reservation_expires_at = now() - interval '1 minute', provider = 'mercado_pago', provider_order_id = 'TESTE-5'
    where id = intent;
  -- Outra pessoa (levantador 5) ocupa a vaga dele no lote nesse meio tempo.
  perform set_config('request.jwt.claims', json_build_object('sub', setters[5], 'role', 'authenticated')::text, true);
  perform * from public.begin_event_payment_reservation(ev);
  begin
    perform public.complete_event_pix_payment(intent, 'TESTE-5');
    raise exception 'TESTE FALHOU: Pix atrasado confirmou com o Lote 1 cheio';
  exception when others then
    if sqlerrm not like 'A reserva já expirou e a vaga foi preenchida%' then raise; end if;
  end;
  perform public.credit_late_event_pix_payment(intent, 'TESTE-5');
  if (select status from public.event_payment_intents where id = intent) <> 'credited'
     or exists (select 1 from public.attendance where event_id = ev and profile_id = setters[1] and status = 'confirmed') then
    raise exception 'TESTE FALHOU: Pix atrasado sem vaga não virou saldo';
  end if;
  log := log || '5 ok; ';

  ------------------------------------------------------------------
  -- 6) Garantido (já confirmado pela organização) paga sem trava de lote.
  ------------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', regs[2], 'role', 'authenticated')::text, true);
  select payment_intent_id into intent from public.begin_event_payment_reservation(ev);
  if (select reserves_capacity from public.event_payment_intents where id = intent) then
    raise exception 'TESTE FALHOU: garantido ocupou vaga nova ao pagar';
  end if;
  log := log || '6 ok; ';

  ------------------------------------------------------------------
  -- 7) Desistência no Lote 1 chama a fila; outra pessoa não fura a fila.
  ------------------------------------------------------------------
  -- Confirma as reservas de levantador pendentes para estabilizar a contagem.
  update public.attendance a set status = 'confirmed', uses_setter_spot = true
    from public.event_payment_intents i
    where i.event_id = ev and i.status = 'pending' and i.uses_setter_spot
      and a.event_id = ev and a.profile_id = i.profile_id;
  update public.event_payment_intents set status = 'expired' where event_id = ev and status = 'pending';
  -- 15 comuns + 3 levantadores = 18 (Lote 1 cheio). Um comum desiste.
  update public.attendance set status = 'declined', cancelled_at = now() where event_id = ev and profile_id = regs[3];
  offered := public.advance_spot_offer(ev);
  if offered is null then
    raise exception 'TESTE FALHOU: a fila não chamou ninguém após a desistência';
  end if;
  r := (select x from unnest(regs[16:22]) x where x <> offered and exists (
          select 1 from public.attendance where event_id = ev and profile_id = x and status = 'interested') limit 1);
  perform set_config('request.jwt.claims', json_build_object('sub', r, 'role', 'authenticated')::text, true);
  begin
    perform * from public.begin_event_payment_reservation(ev);
    raise exception 'TESTE FALHOU: outra pessoa furou a vaga guardada para a fila';
  exception when others then
    if sqlerrm not like 'Essa vaga está reservada pra próxima pessoa da fila%' then raise; end if;
  end;
  perform set_config('request.jwt.claims', json_build_object('sub', offered, 'role', 'authenticated')::text, true);
  perform * from public.begin_event_payment_reservation(ev);
  log := log || '7 ok; ';

  ------------------------------------------------------------------
  -- 8) Lote 2 aberto: comuns e o levantador que faltou entram.
  ------------------------------------------------------------------
  update public.events set second_batch_opens_at = now() - interval '1 second' where id = ev;
  perform set_config('request.jwt.claims', json_build_object('sub', setters[4], 'role', 'authenticated')::text, true);
  select payment_intent_id into intent from public.begin_event_payment_reservation(ev);
  -- Entra na vaga de levantador se ainda houver uma das 4; senão, como comum.
  if (select count(*) from public.attendance where event_id = ev and status = 'confirmed' and uses_setter_spot)
     + (select count(*) from public.event_payment_intents
        where event_id = ev and status = 'pending' and reservation_expires_at > now() and reserves_capacity and uses_setter_spot) > 4 then
    raise exception 'TESTE FALHOU: mais de 4 vagas de levantador ocupadas';
  end if;
  perform set_config('request.jwt.claims', json_build_object('sub', r, 'role', 'authenticated')::text, true);
  perform * from public.begin_event_payment_reservation(ev);
  log := log || '8 ok; ';

  ------------------------------------------------------------------
  -- 9) Racha sem lotes continua igual: 24 vagas, fila protegida.
  ------------------------------------------------------------------
  insert into public.events (date, time, num_teams, team_size, max_players, pix_payment_enabled, price_per_player,
    community, status, official_list_open, created_by, registration_opens_at, newcomer_reserved_spots)
  values (current_date + 6, '10:00', 4, 6, 24, true, 10, 'court', 'open', true, creator, now() - interval '1 minute', 0)
  returning id into ev_plain;
  if public.event_public_capacity((select e from public.events e where id = ev_plain)) <> 24 then
    raise exception 'TESTE FALHOU: racha sem lotes não tem 24 vagas';
  end if;
  insert into public.attendance (event_id, profile_id, status)
    select ev_plain, regs[k], 'confirmed' from generate_series(1, 20) k;
  insert into public.attendance (event_id, profile_id, status)
    select ev_plain, setters[k], 'confirmed' from generate_series(1, 4) k;
  update public.attendance set uses_setter_spot = true where event_id = ev_plain and profile_id = any(setters);
  insert into public.attendance (event_id, profile_id, status, confirmed_at)
    values (ev_plain, regs[21], 'interested', now() - interval '2 minutes'),
           (ev_plain, regs[22], 'interested', now() - interval '1 minute');
  update public.attendance set status = 'declined' where event_id = ev_plain and profile_id = regs[1];
  offered := public.advance_spot_offer(ev_plain);
  if offered is distinct from regs[21] then raise exception 'TESTE FALHOU: fila sem lotes chamou %', offered; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', regs[22], 'role', 'authenticated')::text, true);
  begin
    perform * from public.begin_event_payment_reservation(ev_plain);
    raise exception 'TESTE FALHOU: furou a fila em racha sem lotes';
  exception when others then
    if sqlerrm not like 'Essa vaga está reservada pra próxima pessoa da fila%' then raise; end if;
  end;
  perform set_config('request.jwt.claims', json_build_object('sub', regs[21], 'role', 'authenticated')::text, true);
  perform * from public.begin_event_payment_reservation(ev_plain);
  log := log || '9 ok; ';

  raise exception 'TODOS OS TESTES PASSARAM: %', log;
end $$;
