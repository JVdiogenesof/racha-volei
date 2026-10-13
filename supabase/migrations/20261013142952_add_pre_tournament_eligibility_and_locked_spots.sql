-- Classificados no Torneio VPA não entram em outro pré-torneio do mesmo
-- ciclo. Exceções são sempre registradas por evento e nunca ficam ocultas.
create table public.pre_tournament_eligibility_exceptions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  granted_by uuid not null references public.profiles(id),
  reason text,
  created_at timestamptz not null default now(),
  unique (event_id, profile_id)
);

create index pre_tournament_eligibility_exceptions_event_idx
  on public.pre_tournament_eligibility_exceptions (event_id, profile_id);

-- Uma vaga garantida ocupa a capacidade antes da abertura da lista, mas seu
-- pagamento continua pendente até a própria pessoa concluir o Pix.
create table public.event_locked_players (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  locked_by uuid not null references public.profiles(id),
  note text,
  locked_at timestamptz not null default now(),
  unique (event_id, profile_id)
);

create index event_locked_players_event_idx
  on public.event_locked_players (event_id, locked_at asc);

alter table public.pre_tournament_eligibility_exceptions enable row level security;
alter table public.event_locked_players enable row level security;
grant select on table public.pre_tournament_eligibility_exceptions, public.event_locked_players to authenticated;

create policy "pre_tournament_exceptions_select_organizer"
  on public.pre_tournament_eligibility_exceptions for select to authenticated
  using (public.is_organizer());

create policy "event_locked_players_select_owner_or_organizer"
  on public.event_locked_players for select to authenticated
  using (profile_id = (select auth.uid()) or public.is_organizer());

-- Defesa no banco: vale para interesse normal, confirmação manual, Pix e
-- transferência de vaga. Assim não existe um caminho alternativo que permita
-- a inscrição de quem já está classificado.
create or replace function public.enforce_pre_tournament_eligibility()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events%rowtype;
begin
  if new.status not in ('interested', 'confirmed') then
    return new;
  end if;

  select * into v_event from public.events where id = new.event_id;
  if not found or not v_event.is_pre_torneio then
    return new;
  end if;

  if exists (
    select 1
    from public.tournament_reserved_players qualified
    where qualified.profile_id = new.profile_id
      and qualified.community = v_event.community
  ) and not exists (
    select 1
    from public.pre_tournament_eligibility_exceptions eligible_exception
    where exception.event_id = new.event_id
      and exception.profile_id = new.profile_id
  ) then
    raise exception 'Você já está classificado(a) para o Torneio VPA e não pode entrar neste pré-torneio.';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_pre_tournament_payment_eligibility()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events%rowtype;
begin
  select * into v_event from public.events where id = new.event_id;
  if not found or not v_event.is_pre_torneio then
    return new;
  end if;

  if exists (
    select 1
    from public.tournament_reserved_players qualified
    where qualified.profile_id = new.profile_id
      and qualified.community = v_event.community
  ) and not exists (
    select 1
    from public.pre_tournament_eligibility_exceptions eligible_exception
    where exception.event_id = new.event_id
      and exception.profile_id = new.profile_id
  ) then
    raise exception 'Você já está classificado(a) para o Torneio VPA e não pode gerar Pix para este pré-torneio.';
  end if;

  return new;
end;
$$;

drop trigger if exists attendance_pre_tournament_eligibility on public.attendance;
create trigger attendance_pre_tournament_eligibility
  before insert or update of status on public.attendance
  for each row execute function public.enforce_pre_tournament_eligibility();

drop trigger if exists payment_intent_pre_tournament_eligibility on public.event_payment_intents;
create trigger payment_intent_pre_tournament_eligibility
  before insert on public.event_payment_intents
  for each row execute function public.enforce_pre_tournament_payment_eligibility();

-- Reserva uma pessoa específica. A confirmação acontece imediatamente para
-- ocupar a vaga e o Pix posterior não consome uma segunda vaga.
create or replace function public.lock_event_participant(
  p_event_id uuid,
  p_profile_id uuid,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events%rowtype;
begin
  if not public.is_organizer() then
    raise exception 'Somente organizadores podem garantir vagas.';
  end if;
  if p_profile_id is null then
    raise exception 'Escolha uma pessoa para garantir a vaga.';
  end if;

  select * into v_event from public.events where id = p_event_id for update;
  if not found then raise exception 'Racha não encontrado.'; end if;
  if v_event.status in ('finished', 'cancelled', 'in_progress') then
    raise exception 'Este racha não aceita vagas garantidas.';
  end if;

  perform public.confirm_event_participant(p_event_id, p_profile_id);

  insert into public.event_locked_players (event_id, profile_id, locked_by, note)
  values (p_event_id, p_profile_id, auth.uid(), nullif(trim(coalesce(p_note, '')), ''))
  on conflict (event_id, profile_id) do update
    set note = excluded.note, locked_by = excluded.locked_by, locked_at = now();
end;
$$;

create or replace function public.release_locked_event_participant(
  p_event_id uuid,
  p_profile_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_organizer() then
    raise exception 'Somente organizadores podem liberar vagas garantidas.';
  end if;

  if exists (
    select 1 from public.event_payment_intents
    where event_id = p_event_id and profile_id = p_profile_id and status = 'paid'
  ) or exists (
    select 1 from public.payments
    where event_id = p_event_id and profile_id = p_profile_id and paid
  ) then
    raise exception 'Essa vaga já foi paga. Use o controle de desistência ou transferência para preservar o financeiro.';
  end if;

  delete from public.event_locked_players
  where event_id = p_event_id and profile_id = p_profile_id;

  update public.attendance
  set status = 'declined', cancelled_at = now()
  where event_id = p_event_id and profile_id = p_profile_id and status = 'confirmed';
end;
$$;

create or replace function public.grant_pre_tournament_exception(
  p_event_id uuid,
  p_profile_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events%rowtype;
begin
  if not public.is_organizer() then
    raise exception 'Somente organizadores podem liberar exceções.';
  end if;
  select * into v_event from public.events where id = p_event_id;
  if not found or not v_event.is_pre_torneio then
    raise exception 'A exceção só pode ser usada em um pré-torneio.';
  end if;
  if not exists (
    select 1 from public.tournament_reserved_players
    where profile_id = p_profile_id and community = v_event.community
  ) then
    raise exception 'Essa pessoa ainda não está classificada para o Torneio VPA.';
  end if;

  insert into public.pre_tournament_eligibility_exceptions (event_id, profile_id, granted_by, reason)
  values (p_event_id, p_profile_id, auth.uid(), nullif(trim(coalesce(p_reason, '')), ''))
  on conflict (event_id, profile_id) do update
    set granted_by = excluded.granted_by, reason = excluded.reason, created_at = now();
end;
$$;

create or replace function public.revoke_pre_tournament_exception(
  p_event_id uuid,
  p_profile_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_organizer() then
    raise exception 'Somente organizadores podem remover exceções.';
  end if;
  delete from public.pre_tournament_eligibility_exceptions
  where event_id = p_event_id and profile_id = p_profile_id;
end;
$$;

revoke all on function public.lock_event_participant(uuid, uuid, text) from public, anon;
revoke all on function public.release_locked_event_participant(uuid, uuid) from public, anon;
revoke all on function public.grant_pre_tournament_exception(uuid, uuid, text) from public, anon;
revoke all on function public.revoke_pre_tournament_exception(uuid, uuid) from public, anon;
grant execute on function public.lock_event_participant(uuid, uuid, text) to authenticated;
grant execute on function public.release_locked_event_participant(uuid, uuid) to authenticated;
grant execute on function public.grant_pre_tournament_exception(uuid, uuid, text) to authenticated;
grant execute on function public.revoke_pre_tournament_exception(uuid, uuid) to authenticated;
