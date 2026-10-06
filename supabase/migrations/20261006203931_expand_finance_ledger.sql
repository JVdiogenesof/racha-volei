-- Converte as antigas cortesias unitárias em um saldo monetário por pessoa.
alter table public.free_racha_credits rename to player_balance_entries;

drop policy if exists "free_racha_credits_select_organizer" on public.player_balance_entries;
drop policy if exists "free_racha_credits_insert_organizer" on public.player_balance_entries;
drop policy if exists "free_racha_credits_update_organizer" on public.player_balance_entries;

alter table public.player_balance_entries rename column reason to description;
alter table public.player_balance_entries rename column granted_by to created_by;
alter table public.player_balance_entries rename column granted_at to created_at;
alter table public.player_balance_entries rename column used_event_id to event_id;

alter table public.player_balance_entries
  add column entry_type text not null default 'credit',
  add column amount numeric(10,2),
  add column category text not null default 'other',
  add column cash_effect text not null default 'none',
  add column reversed_at timestamptz,
  add column reversed_by uuid references public.profiles(id) on delete set null;

-- As seis cortesias já cadastradas continuam valendo. Cada uma é convertida
-- pelo preço do racha associado ou, quando ainda não usada, pelo preço mais
-- recente da respectiva modalidade.
update public.player_balance_entries b
set amount = coalesce(
  (select e.price_per_player from public.events e where e.id = b.event_id),
  (select e.price_per_player from public.events e where e.community = b.community and e.price_per_player is not null order by e.date desc limit 1),
  0
),
category = case
  when lower(b.description) like '%desafio%' then 'challenge'
  when lower(b.description) like '%desist%' then 'cancellation_credit'
  when lower(b.description) like '%adiant%' then 'advance_payment'
  else 'other'
end,
cash_effect = case when lower(b.description) like '%desafio%' then 'expense' else 'none' end,
reversed_at = case when b.status = 'available' then null else coalesce(b.used_at, b.cancelled_at, now()) end,
reversed_by = case when b.status = 'available' then null else coalesce(b.used_by, b.cancelled_by) end;

alter table public.player_balance_entries alter column amount set not null;
alter table public.player_balance_entries drop constraint free_racha_credits_status_details_check;
alter table public.player_balance_entries
  drop column status,
  drop column used_by,
  drop column used_at,
  drop column cancelled_by,
  drop column cancelled_at;

drop index if exists public.free_racha_credits_community_status_granted_idx;
drop index if exists public.free_racha_credits_profile_community_idx;

alter table public.player_balance_entries
  add constraint player_balance_entries_type_check check (entry_type in ('credit', 'debit')),
  add constraint player_balance_entries_amount_check check (amount > 0),
  add constraint player_balance_entries_category_check check (category in ('advance_payment', 'cancellation_credit', 'challenge', 'event_payment', 'other')),
  add constraint player_balance_entries_cash_effect_check check (cash_effect in ('none', 'income', 'expense')),
  add constraint player_balance_entries_description_check check (char_length(trim(description)) between 1 and 120);

create index player_balance_entries_profile_community_created_idx
  on public.player_balance_entries (profile_id, community, created_at desc);
create index player_balance_entries_community_created_idx
  on public.player_balance_entries (community, created_at desc);

create policy "player_balance_entries_select_organizer" on public.player_balance_entries for select to authenticated
  using ((select public.is_organizer()));
create policy "player_balance_entries_insert_organizer" on public.player_balance_entries for insert to authenticated
  with check ((select public.is_organizer()) and created_by = (select auth.uid()));
create policy "player_balance_entries_update_organizer" on public.player_balance_entries for update to authenticated
  using ((select public.is_organizer())) with check ((select public.is_organizer()));

grant select, insert, update on table public.player_balance_entries to authenticated;

create table public.finance_transactions (
  id uuid primary key default gen_random_uuid(),
  community text not null check (community in ('court', 'sand')),
  transaction_type text not null check (transaction_type in ('income', 'expense')),
  category text not null check (category in ('event_payment', 'sponsorship', 'court_rental', 'medals', 'balance', 'other')),
  description text not null check (char_length(trim(description)) between 1 and 160),
  amount numeric(10,2) not null check (amount > 0),
  transaction_date date not null default current_date,
  profile_id uuid references public.profiles(id) on delete set null,
  event_id uuid references public.events(id) on delete set null,
  payment_id uuid unique references public.payments(id) on delete set null,
  balance_entry_id uuid unique references public.player_balance_entries(id) on delete set null,
  notes text check (notes is null or char_length(notes) <= 500),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by uuid references public.profiles(id) on delete set null,
  constraint finance_transactions_void_check check ((voided_at is null and voided_by is null) or (voided_at is not null and voided_by is not null))
);

create index finance_transactions_community_date_idx
  on public.finance_transactions (community, transaction_date desc, created_at desc);
alter table public.finance_transactions enable row level security;
create policy "finance_transactions_select_organizer" on public.finance_transactions for select to authenticated
  using ((select public.is_organizer()));
create policy "finance_transactions_insert_organizer" on public.finance_transactions for insert to authenticated
  with check ((select public.is_organizer()) and created_by = (select auth.uid()));
create policy "finance_transactions_update_organizer" on public.finance_transactions for update to authenticated
  using ((select public.is_organizer())) with check ((select public.is_organizer()));
grant select, insert, update on table public.finance_transactions to authenticated;

create table public.finance_reminders (
  id uuid primary key default gen_random_uuid(),
  community text not null check (community in ('court', 'sand')),
  title text not null check (char_length(trim(title)) between 1 and 140),
  notes text check (notes is null or char_length(notes) <= 500),
  due_date date,
  completed boolean not null default false,
  completed_at timestamptz,
  completed_by uuid references public.profiles(id) on delete set null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint finance_reminders_completion_check check ((not completed and completed_at is null and completed_by is null) or (completed and completed_at is not null and completed_by is not null))
);

create index finance_reminders_community_completed_due_idx
  on public.finance_reminders (community, completed, due_date);
alter table public.finance_reminders enable row level security;
create policy "finance_reminders_organizer_all" on public.finance_reminders for all to authenticated
  using ((select public.is_organizer()))
  with check ((select public.is_organizer()));
grant select, insert, update, delete on table public.finance_reminders to authenticated;

alter table public.payments
  add column amount numeric(10,2),
  add column payment_source text not null default 'cash' check (payment_source in ('cash', 'balance')),
  add column balance_entry_id uuid unique references public.player_balance_entries(id) on delete set null;

update public.payments p
set amount = e.price_per_player
from public.events e
where e.id = p.event_id and p.paid and p.amount is null;

create or replace function public.sync_payment_finance_transaction()
returns trigger language plpgsql security invoker set search_path = public as $$
declare v_event public.events%rowtype;
begin
  if new.paid and new.payment_source = 'cash' and new.amount is not null and new.amount > 0 then
    select * into v_event from public.events where id = new.event_id;
    insert into public.finance_transactions (
      community, transaction_type, category, description, amount, transaction_date,
      profile_id, event_id, payment_id, created_by, voided_at, voided_by
    ) values (
      v_event.community, 'income', 'event_payment', 'Pagamento do racha', new.amount,
      v_event.date, new.profile_id, new.event_id, new.id, coalesce(new.marked_by, v_event.created_by), null, null
    )
    on conflict (payment_id) do update set
      amount = excluded.amount,
      transaction_date = excluded.transaction_date,
      created_by = excluded.created_by,
      voided_at = null,
      voided_by = null;
  else
    update public.finance_transactions
      set voided_at = coalesce(voided_at, now()), voided_by = coalesce(voided_by, auth.uid())
      where payment_id = new.id and voided_at is null;
  end if;
  return new;
end;
$$;
revoke all on function public.sync_payment_finance_transaction() from public;
drop trigger if exists sync_payment_finance_transaction on public.payments;
create trigger sync_payment_finance_transaction
  after insert or update of paid, amount, payment_source on public.payments
  for each row execute function public.sync_payment_finance_transaction();

-- Importa pagamentos já marcados antes da criação do caixa.
insert into public.finance_transactions (
  community, transaction_type, category, description, amount, transaction_date,
  profile_id, event_id, payment_id, created_by
)
select e.community, 'income', 'event_payment', 'Pagamento do racha', p.amount, e.date,
       p.profile_id, p.event_id, p.id, coalesce(p.marked_by, e.created_by)
from public.payments p
join public.events e on e.id = p.event_id
where p.paid and p.amount is not null and p.amount > 0
on conflict (payment_id) do nothing;

-- Créditos promocionais antigos passam a aparecer como saída no caixa.
insert into public.finance_transactions (
  community, transaction_type, category, description, amount, transaction_date,
  profile_id, balance_entry_id, created_by
)
select b.community, 'expense', 'balance', b.description, b.amount,
       (b.created_at at time zone 'America/Fortaleza')::date, b.profile_id, b.id, b.created_by
from public.player_balance_entries b
where b.cash_effect = 'expense' and b.reversed_at is null
on conflict (balance_entry_id) do nothing;

create or replace function public.add_player_balance(
  p_profile_id uuid,
  p_community text,
  p_amount numeric,
  p_category text,
  p_description text,
  p_notes text,
  p_cash_effect text
)
returns uuid language plpgsql security invoker set search_path = public as $$
declare v_entry_id uuid; v_transaction_type text;
begin
  if not public.is_organizer() then raise exception 'Somente organizadores podem adicionar saldo.'; end if;
  if p_community not in ('court','sand') or p_amount <= 0 then raise exception 'Dados do saldo inválidos.'; end if;
  if p_category not in ('advance_payment','cancellation_credit','challenge','other') then raise exception 'Motivo inválido.'; end if;
  if p_cash_effect not in ('none','income','expense') then raise exception 'Efeito no caixa inválido.'; end if;
  if not exists(select 1 from public.profiles where id=p_profile_id and p_community=any(communities)) then raise exception 'Pessoa fora desta modalidade.'; end if;

  insert into public.player_balance_entries(profile_id,community,entry_type,amount,category,cash_effect,description,notes,created_by)
  values(p_profile_id,p_community,'credit',p_amount,p_category,p_cash_effect,trim(p_description),nullif(trim(p_notes),''),auth.uid())
  returning id into v_entry_id;

  if p_cash_effect <> 'none' then
    v_transaction_type := case when p_cash_effect='income' then 'income' else 'expense' end;
    insert into public.finance_transactions(community,transaction_type,category,description,amount,transaction_date,profile_id,balance_entry_id,notes,created_by)
    values(p_community,v_transaction_type,'balance',trim(p_description),p_amount,current_date,p_profile_id,v_entry_id,nullif(trim(p_notes),''),auth.uid());
  end if;
  return v_entry_id;
end;
$$;
revoke all on function public.add_player_balance(uuid,text,numeric,text,text,text,text) from public, anon;
grant execute on function public.add_player_balance(uuid,text,numeric,text,text,text,text) to authenticated;

create or replace function public.apply_player_balance(p_event_id uuid, p_profile_id uuid)
returns void language plpgsql security invoker set search_path = public as $$
declare v_event public.events%rowtype; v_balance numeric; v_entry_id uuid; v_existing public.payments%rowtype;
begin
  if not public.is_organizer() then raise exception 'Somente organizadores podem usar saldo.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_profile_id::text || ':' || p_event_id::text, 0));
  select * into v_event from public.events where id=p_event_id;
  if v_event.id is null or v_event.price_per_player is null or v_event.price_per_player <= 0 then raise exception 'Esse racha não possui valor definido.'; end if;
  if not exists(select 1 from public.attendance where event_id=p_event_id and profile_id=p_profile_id and status='confirmed') then raise exception 'A pessoa precisa estar confirmada neste racha.'; end if;
  select * into v_existing from public.payments where event_id=p_event_id and profile_id=p_profile_id;
  if v_existing.paid then raise exception 'Essa pessoa já está marcada como paga.'; end if;
  select coalesce(sum(case when entry_type='credit' then amount else -amount end),0) into v_balance
    from public.player_balance_entries where profile_id=p_profile_id and community=v_event.community and reversed_at is null;
  if v_balance < v_event.price_per_player then raise exception 'Saldo insuficiente para pagar este racha.'; end if;

  insert into public.player_balance_entries(profile_id,community,entry_type,amount,category,cash_effect,description,event_id,created_by)
  values(p_profile_id,v_event.community,'debit',v_event.price_per_player,'event_payment','none','Uso de saldo no racha',p_event_id,auth.uid())
  returning id into v_entry_id;

  insert into public.payments(event_id,profile_id,paid,paid_at,marked_by,amount,payment_source,balance_entry_id)
  values(p_event_id,p_profile_id,true,now(),auth.uid(),v_event.price_per_player,'balance',v_entry_id)
  on conflict(event_id,profile_id) do update set paid=true,paid_at=now(),marked_by=auth.uid(),amount=excluded.amount,payment_source='balance',balance_entry_id=v_entry_id;
end;
$$;
revoke all on function public.apply_player_balance(uuid,uuid) from public, anon;
grant execute on function public.apply_player_balance(uuid,uuid) to authenticated;

create or replace function public.set_event_payment_status(p_event_id uuid, p_profile_id uuid, p_paid boolean)
returns void language plpgsql security invoker set search_path = public as $$
declare v_event public.events%rowtype; v_payment public.payments%rowtype;
begin
  if not public.is_organizer() then raise exception 'Somente organizadores podem alterar pagamentos.'; end if;
  select * into v_event from public.events where id=p_event_id;
  if v_event.id is null then raise exception 'Racha não encontrado.'; end if;
  select * into v_payment from public.payments where event_id=p_event_id and profile_id=p_profile_id for update;

  if p_paid then
    insert into public.payments(event_id,profile_id,paid,paid_at,marked_by,amount,payment_source,balance_entry_id)
    values(p_event_id,p_profile_id,true,now(),auth.uid(),v_event.price_per_player,'cash',null)
    on conflict(event_id,profile_id) do update set paid=true,paid_at=now(),marked_by=auth.uid(),amount=excluded.amount,payment_source='cash',balance_entry_id=null;
  else
    if v_payment.payment_source='balance' and v_payment.balance_entry_id is not null then
      update public.player_balance_entries set reversed_at=now(),reversed_by=auth.uid()
        where id=v_payment.balance_entry_id and reversed_at is null;
    end if;
    update public.payments set paid=false,paid_at=null,marked_by=null,amount=null,payment_source='cash',balance_entry_id=null
      where event_id=p_event_id and profile_id=p_profile_id;
  end if;
end;
$$;
revoke all on function public.set_event_payment_status(uuid,uuid,boolean) from public, anon;
grant execute on function public.set_event_payment_status(uuid,uuid,boolean) to authenticated;

create or replace function public.reverse_player_balance_entry(p_entry_id uuid)
returns void language plpgsql security invoker set search_path = public as $$
declare v_entry public.player_balance_entries%rowtype; v_balance numeric;
begin
  if not public.is_organizer() then raise exception 'Somente organizadores podem corrigir saldo.'; end if;
  select * into v_entry from public.player_balance_entries where id=p_entry_id for update;
  if v_entry.id is null or v_entry.entry_type <> 'credit' or v_entry.reversed_at is not null then
    raise exception 'Este lançamento não pode mais ser estornado.';
  end if;
  select coalesce(sum(case when entry_type='credit' then amount else -amount end),0) into v_balance
    from public.player_balance_entries
    where profile_id=v_entry.profile_id and community=v_entry.community and reversed_at is null;
  if v_balance < v_entry.amount then
    raise exception 'Parte deste saldo já foi utilizada. Desmarque primeiro o pagamento feito com saldo.';
  end if;
  update public.player_balance_entries set reversed_at=now(), reversed_by=auth.uid() where id=p_entry_id;
  update public.finance_transactions set voided_at=now(), voided_by=auth.uid()
    where balance_entry_id=p_entry_id and voided_at is null;
end;
$$;
revoke all on function public.reverse_player_balance_entry(uuid) from public, anon;
grant execute on function public.reverse_player_balance_entry(uuid) to authenticated;
