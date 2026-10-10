-- A pessoa que pagou no Pix pode ceder a própria vaga a alguém que já
-- demonstrou interesse. O pagamento permanece no nome de quem pagou, pois a
-- venda entre as duas pessoas ocorre fora do app; o registro mantém a trilha.
create or replace function public.transfer_event_pix_spot(
  p_event_id uuid,
  p_to_profile_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_from_profile_id uuid := auth.uid();
  v_event public.events%rowtype;
  v_intent public.event_payment_intents%rowtype;
  v_from_attendance public.attendance%rowtype;
  v_to_attendance public.attendance%rowtype;
  v_regular_confirmed integer;
  v_member_capacity integer;
  v_transfer_id uuid;
begin
  if v_from_profile_id is null then raise exception 'Entre na sua conta para transferir a vaga.'; end if;
  if p_to_profile_id is null or p_to_profile_id = v_from_profile_id then
    raise exception 'Escolha outra pessoa para receber a vaga.';
  end if;

  select * into v_event from public.events where id = p_event_id for update;
  if not found or v_event.status in ('finished', 'cancelled', 'in_progress') then
    raise exception 'Este racha não aceita mais transferências de vaga.';
  end if;

  select * into v_intent
  from public.event_payment_intents i
  join public.payments p on p.id = i.payment_id
  where i.event_id = p_event_id
    and i.profile_id = v_from_profile_id
    and i.status = 'paid'
    and i.provider = 'mercado_pago'
    and p.paid = true
    and p.payment_source = 'pix'
  order by i.paid_at desc nulls last
  limit 1
  for update;
  if not found then raise exception 'Nenhuma vaga Pix confirmada foi encontrada para transferir.'; end if;

  select * into v_from_attendance from public.attendance
  where event_id = p_event_id and profile_id = v_from_profile_id
  for update;
  if not found or v_from_attendance.status <> 'confirmed' then
    raise exception 'Sua vaga não está confirmada para transferência.';
  end if;

  select * into v_to_attendance from public.attendance
  where event_id = p_event_id and profile_id = p_to_profile_id
  for update;
  if not found or v_to_attendance.status <> 'interested' then
    raise exception 'A pessoa escolhida precisa estar na lista de interessados.';
  end if;

  -- Não deixa uma vaga reservada para novato virar vaga regular quando as
  -- vagas de membros já chegaram ao limite.
  if v_from_attendance.uses_newcomer_spot and not v_to_attendance.uses_newcomer_spot then
    v_member_capacity := coalesce(v_event.max_players, v_event.num_teams * v_event.team_size) - v_event.newcomer_reserved_spots;
    select count(*)::integer into v_regular_confirmed
    from public.attendance
    where event_id = p_event_id
      and status = 'confirmed'
      and not uses_newcomer_spot
      and profile_id <> v_from_profile_id;
    if v_regular_confirmed >= v_member_capacity then
      raise exception 'Esta vaga está reservada para novato convidado.';
    end if;
  end if;

  update public.attendance
  set status = 'declined', cancelled_at = now()
  where event_id = p_event_id and profile_id = v_from_profile_id;

  update public.attendance
  set status = 'confirmed', confirmed_at = now(), cancelled_at = null
  where event_id = p_event_id and profile_id = p_to_profile_id;

  insert into public.event_payment_transfers (
    payment_intent_id, event_id, from_profile_id, to_profile_id, status, completed_at
  ) values (
    v_intent.id, p_event_id, v_from_profile_id, p_to_profile_id, 'completed', now()
  ) returning id into v_transfer_id;

  update public.event_payment_intents
  set status = 'transferred', cancelled_at = now(), cancellation_choice = 'transfer', updated_at = now()
  where id = v_intent.id;

  return v_transfer_id;
end;
$$;

revoke all on function public.transfer_event_pix_spot(uuid, uuid) from public, anon;
grant execute on function public.transfer_event_pix_spot(uuid, uuid) to authenticated;
