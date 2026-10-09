-- Fundação interna para os pagamentos Pix dos rachas.
-- Nenhuma cobrança é criada por esta migration: o provedor e o QR Code entram
-- em uma etapa posterior. Esta base apenas garante reserva de vaga consistente,
-- auditoria de desistências/transferências e retenção controlada do histórico.

create table public.event_payment_intents (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  payer_profile_id uuid not null references public.profiles(id) on delete restrict,
  payment_id uuid unique references public.payments(id) on delete set null,
  amount numeric(10,2) not null check (amount > 0),
  status text not null default 'pending' check (status in (
    'pending', 'paid', 'expired', 'refund_requested', 'refunded', 'credited',
    'cancelled_late', 'transferred', 'void'
  )),
  provider text check (provider in ('mercado_pago', 'asaas', 'efi')),
  provider_payment_id text,
  provider_reference text,
  reservation_expires_at timestamptz not null,
  paid_at timestamptz,
  cancelled_at timestamptz,
  cancellation_choice text check (cancellation_choice in ('refund', 'balance', 'transfer', 'late_cancel')),
  reserves_capacity boolean not null default true,
  uses_newcomer_spot boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_payment_intents_pending_expiry_check check (
    (status = 'pending' and paid_at is null)
    or status <> 'pending'
  ),
  constraint event_payment_intents_paid_details_check check (
    status <> 'paid' or paid_at is not null
  )
);

create unique index event_payment_intents_one_active_profile_event_idx
  on public.event_payment_intents (event_id, profile_id)
  where status in ('pending', 'paid');

create unique index event_payment_intents_provider_payment_idx
  on public.event_payment_intents (provider, provider_payment_id)
  where provider is not null and provider_payment_id is not null;

create index event_payment_intents_event_pending_idx
  on public.event_payment_intents (event_id, reservation_expires_at)
  where status = 'pending';

create index event_payment_intents_profile_created_idx
  on public.event_payment_intents (profile_id, created_at desc);

create table public.event_payment_transfers (
  id uuid primary key default gen_random_uuid(),
  payment_intent_id uuid not null references public.event_payment_intents(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  from_profile_id uuid not null references public.profiles(id) on delete restrict,
  to_profile_id uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending', 'completed', 'cancelled', 'expired')),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  cancelled_at timestamptz,
  constraint event_payment_transfers_distinct_players_check check (from_profile_id <> to_profile_id),
  constraint event_payment_transfers_completion_check check (
    (status = 'completed' and completed_at is not null and cancelled_at is null)
    or (status = 'cancelled' and cancelled_at is not null and completed_at is null)
    or (status in ('pending', 'expired') and completed_at is null and cancelled_at is null)
  )
);

create index event_payment_transfers_event_created_idx
  on public.event_payment_transfers (event_id, created_at desc);
create index event_payment_transfers_participants_idx
  on public.event_payment_transfers (from_profile_id, to_profile_id, created_at desc);

alter table public.event_payment_intents enable row level security;
alter table public.event_payment_transfers enable row level security;

create policy "event_payment_intents_select_owner_or_organizer"
  on public.event_payment_intents for select to authenticated
  using (profile_id = (select auth.uid()) or payer_profile_id = (select auth.uid()) or (select public.is_organizer()));

create policy "event_payment_transfers_select_participant_or_organizer"
  on public.event_payment_transfers for select to authenticated
  using (
    from_profile_id = (select auth.uid())
    or to_profile_id = (select auth.uid())
    or (select public.is_organizer())
  );

grant select on table public.event_payment_intents, public.event_payment_transfers to authenticated;

-- A reserva só pode ser iniciada pela própria pessoa, já interessada no racha.
-- A linha do evento é bloqueada durante o cálculo para impedir que duas pessoas
-- reservem a última vaga ao mesmo tempo.
create or replace function public.begin_event_payment_reservation(p_event_id uuid)
returns table (payment_intent_id uuid, amount numeric, reservation_expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := auth.uid();
  v_event public.events%rowtype;
  v_profile_status public.profile_status;
  v_guest_for_event_id uuid;
  v_attendance_status public.attendance_status;
  v_existing public.event_payment_intents%rowtype;
  v_capacity integer;
  v_confirmed_total integer;
  v_confirmed_regulars integer;
  v_reserved_total integer;
  v_reserved_regulars integer;
  v_is_newcomer boolean;
  v_reserves_capacity boolean;
begin
  if v_profile_id is null then
    raise exception 'Entre na sua conta para reservar uma vaga.';
  end if;

  select * into v_event from public.events where id = p_event_id for update;
  if not found then raise exception 'Racha não encontrado.'; end if;
  if v_event.status in ('finished', 'cancelled', 'in_progress') then
    raise exception 'Esse racha não aceita pagamentos neste momento.';
  end if;
  if not v_event.official_list_open
    or (v_event.registration_opens_at is not null and v_event.registration_opens_at > now()) then
    raise exception 'As inscrições deste racha ainda não estão abertas.';
  end if;
  if v_event.price_per_player is null or v_event.price_per_player <= 0 then
    raise exception 'Este racha ainda não possui valor para pagamento.';
  end if;

  select status, guest_for_event_id into v_profile_status, v_guest_for_event_id
  from public.profiles where id = v_profile_id;
  if not found then raise exception 'Perfil não encontrado.'; end if;
  v_is_newcomer := v_profile_status = 'guest' and v_guest_for_event_id = p_event_id;
  if v_profile_status <> 'approved' and not v_is_newcomer then
    raise exception 'Você precisa estar autorizado para reservar uma vaga.';
  end if;

  select status into v_attendance_status
  from public.attendance
  where event_id = p_event_id and profile_id = v_profile_id;
  if v_attendance_status not in ('interested', 'confirmed') then
    raise exception 'Demonstre interesse neste racha antes de reservar a vaga.';
  end if;

  -- Qualquer reserva vencida deixa de ocupar vaga antes da nova contagem.
  update public.event_payment_intents
  set status = 'expired', updated_at = now()
  where event_id = p_event_id
    and status = 'pending'
    and reservation_expires_at <= now();

  select * into v_existing
  from public.event_payment_intents
  where event_id = p_event_id
    and profile_id = v_profile_id
    and status in ('pending', 'paid')
  order by created_at desc
  limit 1;

  if found then
    if v_existing.status = 'paid' then
      raise exception 'Este racha já está pago para esta pessoa.';
    end if;
    return query select v_existing.id, v_existing.amount, v_existing.reservation_expires_at;
    return;
  end if;

  v_reserves_capacity := v_attendance_status <> 'confirmed';
  v_capacity := coalesce(v_event.max_players, v_event.num_teams * v_event.team_size);

  if v_reserves_capacity then
    select
      count(*)::integer,
      count(*) filter (where not uses_newcomer_spot)::integer
    into v_confirmed_total, v_confirmed_regulars
    from public.attendance
    where event_id = p_event_id and status = 'confirmed';

    select
      count(*)::integer,
      count(*) filter (where not uses_newcomer_spot)::integer
    into v_reserved_total, v_reserved_regulars
    from public.event_payment_intents
    where event_id = p_event_id
      and status = 'pending'
      and reservation_expires_at > now()
      and reserves_capacity;

    if v_confirmed_total + v_reserved_total >= v_capacity then
      raise exception 'As vagas deste racha já foram reservadas.';
    end if;

    if not v_is_newcomer
      and v_confirmed_regulars + v_reserved_regulars >= v_capacity - v_event.newcomer_reserved_spots then
      raise exception 'As vagas restantes estão protegidas para novatos convidados.';
    end if;
  end if;

  return query
  insert into public.event_payment_intents (
    event_id, profile_id, payer_profile_id, amount, status, reservation_expires_at,
    reserves_capacity, uses_newcomer_spot
  ) values (
    p_event_id, v_profile_id, v_profile_id, v_event.price_per_player, 'pending',
    now() + interval '5 minutes', v_reserves_capacity, v_is_newcomer
  )
  returning id, amount, reservation_expires_at;
end;
$$;

revoke all on function public.begin_event_payment_reservation(uuid) from public, anon;
grant execute on function public.begin_event_payment_reservation(uuid) to authenticated;

-- Será chamado pelo futuro webhook do provedor antes de cada nova reserva e
-- também poderá ser agendado quando a integração Pix estiver ativa.
create or replace function public.expire_event_payment_reservations()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expired integer;
begin
  update public.event_payment_intents
  set status = 'expired', updated_at = now()
  where status = 'pending' and reservation_expires_at <= now();
  get diagnostics v_expired = row_count;
  return v_expired;
end;
$$;

revoke all on function public.expire_event_payment_reservations() from public, anon, authenticated;
grant execute on function public.expire_event_payment_reservations() to service_role;

-- A movimentação financeira consolidada continuará no caixa/saldos existente.
-- Após 60 dias, dados operacionais finalizados podem sair sem afetar esse livro-caixa.
create or replace function public.purge_old_event_payment_records()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  delete from public.event_payment_intents i
  using public.events e
  where i.event_id = e.id
    and e.date < current_date
    and i.status <> 'pending'
    and coalesce(i.cancelled_at, i.paid_at, i.created_at) < now() - interval '60 days';
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.purge_old_event_payment_records() from public, anon, authenticated;
grant execute on function public.purge_old_event_payment_records() to service_role;
