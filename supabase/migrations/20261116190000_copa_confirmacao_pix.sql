-- Confirmação de presença na Copa VPA, com prazo e Pix automático.
-- Migração aditiva: só acrescenta colunas e tabelas novas; nada do que roda
-- hoje (rachas, pagamentos dos rachas) é alterado.
--
-- Regras:
--  * Só quem está classificado (cup_qualified_players) pode confirmar.
--  * A organização define valor (confirm_amount) e prazo (confirm_deadline) na
--    página da Copa. Sem prazo definido, a confirmação fica fechada.
--  * Sem valor = confirmação gratuita (um toque). Com valor = Pix do Mercado Pago.
--  * O Pix só vale se a cobrança foi gerada antes do prazo; quem paga depois
--    do prazo (ou já sem a vaga) fica como 'refund_needed' para a organização
--    devolver manualmente. O dinheiro nunca "some".

alter table public.cups
  add column if not exists confirm_amount numeric(10,2)
    check (confirm_amount is null or confirm_amount > 0),
  add column if not exists confirm_deadline timestamptz;

create table if not exists public.cup_confirmations (
  id uuid primary key default gen_random_uuid(),
  cup_id uuid not null references public.cups(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  status text not null check (status in ('confirmed', 'declined')),
  -- 'pix' = pago pelo app; 'free' = confirmação sem cobrança;
  -- 'manual' = organização marcou (dinheiro/Pix fora do app).
  payment_source text check (payment_source in ('pix', 'free', 'manual')),
  amount numeric(10,2) check (amount is null or amount >= 0),
  decided_at timestamptz not null default now(),
  unique (cup_id, profile_id)
);

create index if not exists cup_confirmations_profile_idx on public.cup_confirmations (profile_id);

create table if not exists public.cup_payment_intents (
  id uuid primary key default gen_random_uuid(),
  cup_id uuid not null references public.cups(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(10,2) not null check (amount > 0),
  status text not null default 'pending' check (status in ('pending', 'paid', 'expired', 'refund_needed', 'refunded')),
  provider text not null default 'mercado_pago' check (provider in ('mercado_pago')),
  provider_order_id text,
  provider_reference text,
  -- Validade do código Pix (o Mercado Pago exige ao menos 30 minutos).
  expires_at timestamptz not null,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists cup_payment_intents_one_pending_idx
  on public.cup_payment_intents (cup_id, profile_id) where status = 'pending';
create unique index if not exists cup_payment_intents_provider_order_idx
  on public.cup_payment_intents (provider, provider_order_id) where provider_order_id is not null;
create index if not exists cup_payment_intents_cup_idx on public.cup_payment_intents (cup_id, status);
create index if not exists cup_payment_intents_profile_idx on public.cup_payment_intents (profile_id, created_at desc);

alter table public.cup_confirmations enable row level security;
alter table public.cup_payment_intents enable row level security;

revoke all on table public.cup_confirmations, public.cup_payment_intents from anon, authenticated;
-- A leitura é aberta (a lista de confirmados é pública para quem está logado).
-- Toda escrita das pessoas passa pelas funções abaixo; a organização escreve direto.
grant select on table public.cup_confirmations, public.cup_payment_intents to authenticated;
grant insert, update, delete on table public.cup_confirmations to authenticated;

drop policy if exists "cup_confirmations_select" on public.cup_confirmations;
create policy "cup_confirmations_select" on public.cup_confirmations for select to authenticated using (true);
drop policy if exists "cup_confirmations_write_organizer" on public.cup_confirmations;
create policy "cup_confirmations_write_organizer" on public.cup_confirmations for all to authenticated
  using ((select public.is_organizer())) with check ((select public.is_organizer()));

drop policy if exists "cup_payment_intents_select" on public.cup_payment_intents;
create policy "cup_payment_intents_select" on public.cup_payment_intents for select to authenticated
  using (profile_id = (select auth.uid()) or (select public.is_organizer()));

-- Confere se a pessoa pode confirmar agora e devolve a copa já bloqueada.
create or replace function public.cup_confirmation_gate(p_cup_id uuid, p_profile_id uuid)
returns public.cups
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cup public.cups%rowtype;
begin
  select * into v_cup from public.cups where id = p_cup_id for share;
  if not found then
    raise exception 'Copa não encontrada.';
  end if;
  if not exists (
    select 1 from public.cup_qualified_players where cup_id = p_cup_id and profile_id = p_profile_id
  ) then
    raise exception 'Só quem está classificado para a Copa pode confirmar presença.';
  end if;
  if v_cup.confirm_deadline is null then
    raise exception 'A confirmação de presença ainda não foi aberta.';
  end if;
  if v_cup.confirm_deadline <= now() then
    raise exception 'O prazo para confirmar presença terminou.';
  end if;
  return v_cup;
end;
$$;

revoke all on function public.cup_confirmation_gate(uuid, uuid) from public, anon, authenticated;

-- Confirmação gratuita (copa sem valor definido).
create or replace function public.confirm_cup_presence_free(p_cup_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cup public.cups%rowtype;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Entre na sua conta novamente.'; end if;
  v_cup := public.cup_confirmation_gate(p_cup_id, v_uid);
  if v_cup.confirm_amount is not null then
    raise exception 'Esta confirmação é paga: use o Pix.';
  end if;
  insert into public.cup_confirmations (cup_id, profile_id, status, payment_source, amount)
  values (p_cup_id, v_uid, 'confirmed', 'free', null)
  on conflict (cup_id, profile_id) do update
    set status = 'confirmed', payment_source = 'free', amount = null, decided_at = now()
    where public.cup_confirmations.status = 'declined';
end;
$$;

-- Desistência: só quem ainda não pagou. Quem já pagou fala com a organização
-- (a devolução do Pix é feita à mão).
create or replace function public.decline_cup_presence(p_cup_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_existing public.cup_confirmations%rowtype;
begin
  if v_uid is null then raise exception 'Entre na sua conta novamente.'; end if;
  perform public.cup_confirmation_gate(p_cup_id, v_uid);
  select * into v_existing from public.cup_confirmations where cup_id = p_cup_id and profile_id = v_uid;
  if found and v_existing.status = 'confirmed' and v_existing.payment_source in ('pix', 'manual') then
    raise exception 'Você já pagou: fale com a organização para cancelar e pedir a devolução.';
  end if;
  insert into public.cup_confirmations (cup_id, profile_id, status, payment_source, amount)
  values (p_cup_id, v_uid, 'declined', null, null)
  on conflict (cup_id, profile_id) do update
    set status = 'declined', payment_source = null, amount = null, decided_at = now();
  -- Um código Pix ainda aberto não pode mais ser pago.
  update public.cup_payment_intents set status = 'expired', updated_at = now()
  where cup_id = p_cup_id and profile_id = v_uid and status = 'pending';
end;
$$;

-- Começa (ou retoma) a cobrança Pix. Reaproveita o código ainda válido.
create or replace function public.begin_cup_payment(p_cup_id uuid)
returns table (payment_intent_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cup public.cups%rowtype;
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null then raise exception 'Entre na sua conta novamente.'; end if;
  v_cup := public.cup_confirmation_gate(p_cup_id, v_uid);
  if v_cup.confirm_amount is null then
    raise exception 'Esta confirmação é gratuita: não há Pix para pagar.';
  end if;
  if exists (
    select 1 from public.cup_confirmations
    where cup_id = p_cup_id and profile_id = v_uid and status = 'confirmed'
  ) then
    raise exception 'Sua presença já está confirmada (já está pago).';
  end if;

  update public.cup_payment_intents set status = 'expired', updated_at = now()
  where cup_id = p_cup_id and profile_id = v_uid and status = 'pending' and expires_at <= now();

  select id into v_id from public.cup_payment_intents
  where cup_id = p_cup_id and profile_id = v_uid and status = 'pending'
  limit 1;

  if v_id is null then
    insert into public.cup_payment_intents (cup_id, profile_id, amount, expires_at)
    values (p_cup_id, v_uid, v_cup.confirm_amount, now() + interval '30 minutes')
    returning id into v_id;
  end if;
  return query select v_id;
end;
$$;

create or replace function public.attach_cup_payment_provider_order(
  p_intent_id uuid,
  p_provider_order_id text,
  p_provider_reference text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.cup_payment_intents
  set provider_order_id = trim(p_provider_order_id),
      provider_reference = trim(p_provider_reference),
      updated_at = now()
  where id = p_intent_id
    and profile_id = auth.uid()
    and status = 'pending'
    and (provider_order_id is null or provider_order_id = trim(p_provider_order_id));
  if not found then
    raise exception 'Cobrança não encontrada.';
  end if;
end;
$$;

-- Conclusão do pagamento: só o servidor (service_role) chama, depois de
-- consultar o pedido no Mercado Pago. Devolve 'paid' ou 'refund_needed'.
create or replace function public.complete_cup_pix_payment(
  p_intent_id uuid,
  p_provider_order_id text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_intent public.cup_payment_intents%rowtype;
  v_cup public.cups%rowtype;
  v_ok boolean;
begin
  select * into v_intent from public.cup_payment_intents where id = p_intent_id for update;
  if not found then raise exception 'Cobrança não encontrada.'; end if;
  if v_intent.provider_order_id is distinct from trim(p_provider_order_id) then
    raise exception 'A cobrança não corresponde ao pedido.';
  end if;
  if v_intent.status = 'paid' then return 'paid'; end if;
  if v_intent.status in ('refund_needed', 'refunded') then return 'refund_needed'; end if;

  select * into v_cup from public.cups where id = v_intent.cup_id for update;

  -- Vale se a cobrança nasceu antes do prazo, a pessoa segue classificada e
  -- não desistiu nesse meio tempo.
  v_ok := v_cup.confirm_deadline is not null
    and v_intent.created_at < v_cup.confirm_deadline
    and exists (select 1 from public.cup_qualified_players where cup_id = v_intent.cup_id and profile_id = v_intent.profile_id)
    and not exists (
      select 1 from public.cup_confirmations
      where cup_id = v_intent.cup_id and profile_id = v_intent.profile_id and status = 'declined'
        and decided_at > v_intent.created_at
    );

  if not v_ok then
    update public.cup_payment_intents
    set status = 'refund_needed', paid_at = now(), updated_at = now()
    where id = v_intent.id;
    return 'refund_needed';
  end if;

  insert into public.cup_confirmations (cup_id, profile_id, status, payment_source, amount)
  values (v_intent.cup_id, v_intent.profile_id, 'confirmed', 'pix', v_intent.amount)
  on conflict (cup_id, profile_id) do update
    set status = 'confirmed', payment_source = 'pix', amount = excluded.amount, decided_at = now();

  update public.cup_payment_intents
  set status = 'paid', paid_at = now(), updated_at = now()
  where id = v_intent.id;
  return 'paid';
end;
$$;

revoke all on function public.confirm_cup_presence_free(uuid) from public, anon;
revoke all on function public.decline_cup_presence(uuid) from public, anon;
revoke all on function public.begin_cup_payment(uuid) from public, anon;
revoke all on function public.attach_cup_payment_provider_order(uuid, text, text) from public, anon;
revoke all on function public.complete_cup_pix_payment(uuid, text) from public, anon, authenticated;
grant execute on function public.confirm_cup_presence_free(uuid) to authenticated;
grant execute on function public.decline_cup_presence(uuid) to authenticated;
grant execute on function public.begin_cup_payment(uuid) to authenticated;
grant execute on function public.attach_cup_payment_provider_order(uuid, text, text) to authenticated;
grant execute on function public.complete_cup_pix_payment(uuid, text) to service_role;
