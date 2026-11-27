-- Aba "Apoiar": doações por Pix (Mercado Pago, mesma conta dos rachas).
-- Migração aditiva: só cria tabelas e funções novas.
--
-- Regras:
--  * Só quem está logado vê e doa.
--  * Existe sempre uma campanha geral ("Apoie o VPA"), que não pode ser encerrada.
--  * A organização (nível completo) cria campanhas para eventos, aniversários etc.,
--    com meta opcional, e encerra quando quiser.
--  * A pessoa escolhe o valor (R$ 1 a R$ 5.000).
--  * Todos veem só o total arrecadado de cada campanha; quem doou e quanto, só a organização.
--  * Doação nunca é devolvida automaticamente: um Pix pago conta sempre, mesmo
--    se o código tinha vencido ou a campanha foi encerrada nesse meio tempo.

create table if not exists public.donation_campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 2 and 80),
  description text check (description is null or length(description) <= 600),
  goal_amount numeric(10,2) check (goal_amount is null or goal_amount > 0),
  is_general boolean not null default false,
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not is_general or active)
);

create unique index if not exists donation_campaigns_one_general_idx
  on public.donation_campaigns (is_general) where is_general;

create table if not exists public.donation_intents (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.donation_campaigns(id) on delete restrict,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(10,2) not null check (amount >= 1 and amount <= 5000),
  status text not null default 'pending' check (status in ('pending', 'paid', 'expired')),
  provider text not null default 'mercado_pago' check (provider in ('mercado_pago')),
  provider_order_id text,
  provider_reference text,
  -- Validade do código Pix (o Mercado Pago exige ao menos 30 minutos).
  expires_at timestamptz not null,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists donation_intents_provider_order_idx
  on public.donation_intents (provider, provider_order_id) where provider_order_id is not null;
create index if not exists donation_intents_campaign_idx on public.donation_intents (campaign_id, status);
create index if not exists donation_intents_profile_idx on public.donation_intents (profile_id, created_at desc);

alter table public.donation_campaigns enable row level security;
alter table public.donation_intents enable row level security;

revoke all on table public.donation_campaigns, public.donation_intents from anon, authenticated;
grant select on table public.donation_campaigns, public.donation_intents to authenticated;
grant insert, update on table public.donation_campaigns to authenticated;

drop policy if exists "donation_campaigns_select" on public.donation_campaigns;
create policy "donation_campaigns_select" on public.donation_campaigns for select to authenticated using (true);
drop policy if exists "donation_campaigns_insert_organizer" on public.donation_campaigns;
create policy "donation_campaigns_insert_organizer" on public.donation_campaigns for insert to authenticated
  with check ((select public.is_full_organizer()) and not is_general);
drop policy if exists "donation_campaigns_update_organizer" on public.donation_campaigns;
create policy "donation_campaigns_update_organizer" on public.donation_campaigns for update to authenticated
  using ((select public.is_full_organizer())) with check ((select public.is_full_organizer()));

-- Cada pessoa vê as próprias doações; a organização vê todas.
drop policy if exists "donation_intents_select" on public.donation_intents;
create policy "donation_intents_select" on public.donation_intents for select to authenticated
  using (profile_id = (select auth.uid()) or (select public.is_full_organizer()));

-- Total arrecadado de cada campanha (só o valor, sem nomes).
create or replace function public.donation_campaign_totals()
returns table (campaign_id uuid, total numeric, donations bigint)
language sql
security definer
set search_path = public
stable
as $$
  select c.id, coalesce(sum(d.amount) filter (where d.status = 'paid'), 0), count(d.id) filter (where d.status = 'paid')
  from public.donation_campaigns c
  left join public.donation_intents d on d.campaign_id = c.id
  where auth.uid() is not null
  group by c.id;
$$;

-- Começa uma doação: valida campanha e valor e cria a cobrança.
create or replace function public.begin_donation(p_campaign_id uuid, p_amount numeric)
returns table (payment_intent_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_amount numeric(10,2) := round(p_amount, 2);
  v_id uuid;
begin
  if v_uid is null then raise exception 'Entre na sua conta novamente.'; end if;
  if not exists (select 1 from public.profiles where id = v_uid) then
    raise exception 'Complete seu cadastro para apoiar.';
  end if;
  if not exists (select 1 from public.donation_campaigns where id = p_campaign_id and active) then
    raise exception 'Esta campanha foi encerrada.';
  end if;
  if v_amount is null or v_amount < 1 then raise exception 'O valor mínimo é R$ 1,00.'; end if;
  if v_amount > 5000 then raise exception 'O valor máximo por Pix é R$ 5.000,00.'; end if;
  -- Evita abuso: no máximo 10 códigos em aberto por pessoa.
  if (select count(*) from public.donation_intents
      where profile_id = v_uid and status = 'pending' and expires_at > now()) >= 10 then
    raise exception 'Você já tem vários códigos Pix em aberto. Pague um deles ou espere vencer.';
  end if;

  insert into public.donation_intents (campaign_id, profile_id, amount, expires_at)
  values (p_campaign_id, v_uid, v_amount, now() + interval '30 minutes')
  returning id into v_id;
  return query select v_id;
end;
$$;

create or replace function public.attach_donation_provider_order(
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
  update public.donation_intents
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

-- Conclusão: só o servidor (service_role) chama, depois de conferir no Mercado Pago.
create or replace function public.complete_donation_pix_payment(
  p_intent_id uuid,
  p_provider_order_id text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_intent public.donation_intents%rowtype;
begin
  select * into v_intent from public.donation_intents where id = p_intent_id for update;
  if not found then raise exception 'Cobrança não encontrada.'; end if;
  if v_intent.provider_order_id is distinct from trim(p_provider_order_id) then
    raise exception 'A cobrança não corresponde ao pedido.';
  end if;
  if v_intent.status <> 'paid' then
    update public.donation_intents
    set status = 'paid', paid_at = now(), updated_at = now()
    where id = v_intent.id;
  end if;
  return 'paid';
end;
$$;

revoke all on function public.donation_campaign_totals() from public, anon;
revoke all on function public.begin_donation(uuid, numeric) from public, anon;
revoke all on function public.attach_donation_provider_order(uuid, text, text) from public, anon;
revoke all on function public.complete_donation_pix_payment(uuid, text) from public, anon, authenticated;
grant execute on function public.donation_campaign_totals() to authenticated;
grant execute on function public.begin_donation(uuid, numeric) to authenticated;
grant execute on function public.attach_donation_provider_order(uuid, text, text) to authenticated;
grant execute on function public.complete_donation_pix_payment(uuid, text) to service_role;

insert into public.donation_campaigns (title, description, is_general, active)
select 'Apoie o VPA',
       'Ajude a manter o Racha Vôlei por Amor: bolas, redes, premiações, aniversários e eventos do grupo. Qualquer valor faz diferença!',
       true, true
where not exists (select 1 from public.donation_campaigns where is_general);
