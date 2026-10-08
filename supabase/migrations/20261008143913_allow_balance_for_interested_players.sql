-- Usar saldo para alguém que já demonstrou interesse confirma essa pessoa e
-- registra o pagamento na mesma transação. Se faltar saldo ou vaga, nada muda.
create or replace function public.apply_player_balance(p_event_id uuid, p_profile_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_event public.events%rowtype;
  v_balance numeric;
  v_entry_id uuid;
  v_existing public.payments%rowtype;
  v_attendance_status public.attendance_status;
begin
  if not public.is_organizer() then
    raise exception 'Somente organizadores podem usar saldo.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_profile_id::text || ':' || p_event_id::text, 0));

  select * into v_event
  from public.events
  where id = p_event_id;

  if v_event.id is null or v_event.price_per_player is null or v_event.price_per_player <= 0 then
    raise exception 'Esse racha não possui valor definido.';
  end if;

  select status into v_attendance_status
  from public.attendance
  where event_id = p_event_id and profile_id = p_profile_id;

  if v_attendance_status is null then
    raise exception 'A pessoa precisa demonstrar interesse neste racha antes de usar saldo.';
  end if;

  if v_attendance_status not in ('interested', 'confirmed') then
    raise exception 'Só é possível usar saldo para uma pessoa interessada ou confirmada.';
  end if;

  select * into v_existing
  from public.payments
  where event_id = p_event_id and profile_id = p_profile_id;

  if v_existing.paid then
    raise exception 'Essa pessoa já está marcada como paga.';
  end if;

  select coalesce(sum(case when entry_type = 'credit' then amount else -amount end), 0)
  into v_balance
  from public.player_balance_entries
  where profile_id = p_profile_id
    and community = v_event.community
    and reversed_at is null;

  if v_balance < v_event.price_per_player then
    raise exception 'Saldo insuficiente para pagar este racha.';
  end if;

  if v_attendance_status = 'interested' then
    -- A função de confirmação mantém as regras de limite e vagas reservadas.
    -- Qualquer erro aqui desfaz a operação inteira, inclusive o pagamento.
    perform public.confirm_event_participant(p_event_id, p_profile_id);
  end if;

  insert into public.player_balance_entries (
    profile_id, community, entry_type, amount, category, cash_effect,
    description, event_id, created_by
  )
  values (
    p_profile_id, v_event.community, 'debit', v_event.price_per_player,
    'event_payment', 'none', 'Uso de saldo no racha', p_event_id, auth.uid()
  )
  returning id into v_entry_id;

  insert into public.payments (
    event_id, profile_id, paid, paid_at, marked_by, amount, payment_source,
    balance_entry_id
  )
  values (
    p_event_id, p_profile_id, true, now(), auth.uid(), v_event.price_per_player,
    'balance', v_entry_id
  )
  on conflict (event_id, profile_id) do update set
    paid = true,
    paid_at = now(),
    marked_by = auth.uid(),
    amount = excluded.amount,
    payment_source = 'balance',
    balance_entry_id = v_entry_id;
end;
$$;

revoke all on function public.apply_player_balance(uuid, uuid) from public, anon;
grant execute on function public.apply_player_balance(uuid, uuid) to authenticated;
