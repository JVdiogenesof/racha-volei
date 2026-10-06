create table public.shirt_finance_transactions (
  id uuid primary key default gen_random_uuid(),
  community text not null check (community in ('court', 'sand')),
  description text not null check (char_length(trim(description)) between 1 and 160),
  amount numeric(10,2) not null check (amount > 0),
  transaction_date date not null default current_date,
  profile_id uuid references public.profiles(id) on delete set null,
  shirt_order_id uuid references public.shirt_orders(id) on delete set null,
  payment_stage text not null check (payment_stage in ('deposit', 'remainder')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by uuid references public.profiles(id) on delete set null,
  constraint shirt_finance_transactions_void_check check ((voided_at is null and voided_by is null) or (voided_at is not null and voided_by is not null))
);

create unique index shirt_finance_transactions_order_stage_unique
  on public.shirt_finance_transactions (shirt_order_id, payment_stage)
  where shirt_order_id is not null;
create index shirt_finance_transactions_community_date_idx
  on public.shirt_finance_transactions (community, transaction_date desc, created_at desc);

alter table public.shirt_finance_transactions enable row level security;
create policy "shirt_finance_transactions_select_organizer" on public.shirt_finance_transactions for select to authenticated
  using ((select public.is_organizer()));
create policy "shirt_finance_transactions_insert_organizer" on public.shirt_finance_transactions for insert to authenticated
  with check ((select public.is_organizer()) and created_by = (select auth.uid()));
create policy "shirt_finance_transactions_update_organizer" on public.shirt_finance_transactions for update to authenticated
  using ((select public.is_organizer())) with check ((select public.is_organizer()));
grant select, insert, update on table public.shirt_finance_transactions to authenticated;

-- Preserva todo o histórico já registrado, mas o remove definitivamente do
-- livro-caixa geral dos rachas.
insert into public.shirt_finance_transactions (
  id, community, description, amount, transaction_date, profile_id,
  shirt_order_id, payment_stage, created_by, created_at, voided_at, voided_by
)
select id, community, description, amount, transaction_date, profile_id,
       shirt_order_id, shirt_payment_stage, created_by, created_at, voided_at, voided_by
from public.finance_transactions
where category = 'shirt_sale';

delete from public.finance_transactions where category = 'shirt_sale';

drop trigger if exists sync_shirt_order_finance_transactions on public.shirt_orders;
drop function if exists public.sync_shirt_order_finance_transactions();

drop index if exists public.finance_transactions_shirt_order_stage_unique;
alter table public.finance_transactions
  drop constraint if exists finance_transactions_shirt_stage_check,
  drop constraint if exists finance_transactions_category_check,
  drop column if exists shirt_payment_stage,
  drop column if exists shirt_order_id;
alter table public.finance_transactions
  add constraint finance_transactions_category_check
    check (category in ('event_payment', 'sponsorship', 'court_rental', 'medals', 'balance', 'other'));

create or replace function public.sync_shirt_order_finance_transactions()
returns trigger language plpgsql security invoker set search_path = public as $$
declare
  v_total numeric(10,2);
  v_half numeric(10,2);
  v_model_label text;
  v_actor uuid;
begin
  v_total := (case when new.model = 'tank' then 37 else 41 end) * new.quantity;
  v_half := v_total / 2;
  v_model_label := case when new.model = 'tank' then 'Regata' else 'Camisa com manga' end;
  v_actor := coalesce(new.marked_by, auth.uid());

  if new.half_paid or new.paid then
    insert into public.shirt_finance_transactions (
      community, description, amount, transaction_date, profile_id,
      shirt_order_id, payment_stage, created_by, voided_at, voided_by
    ) values (
      new.community, v_model_label || ' · entrada de 50%', v_half,
      (coalesce(new.paid_at, now()) at time zone 'America/Fortaleza')::date,
      new.profile_id, new.id, 'deposit', v_actor, null, null
    )
    on conflict (shirt_order_id, payment_stage) where shirt_order_id is not null do update set
      amount = excluded.amount,
      transaction_date = case when shirt_finance_transactions.voided_at is null then shirt_finance_transactions.transaction_date else excluded.transaction_date end,
      created_by = excluded.created_by,
      voided_at = null,
      voided_by = null;
  else
    update public.shirt_finance_transactions set voided_at=coalesce(voided_at,now()), voided_by=coalesce(voided_by,v_actor)
      where shirt_order_id=new.id and payment_stage='deposit' and voided_at is null;
  end if;

  if new.paid then
    insert into public.shirt_finance_transactions (
      community, description, amount, transaction_date, profile_id,
      shirt_order_id, payment_stage, created_by, voided_at, voided_by
    ) values (
      new.community, v_model_label || ' · quitação', v_half,
      (coalesce(new.paid_at, now()) at time zone 'America/Fortaleza')::date,
      new.profile_id, new.id, 'remainder', v_actor, null, null
    )
    on conflict (shirt_order_id, payment_stage) where shirt_order_id is not null do update set
      amount = excluded.amount,
      transaction_date = case when shirt_finance_transactions.voided_at is null then shirt_finance_transactions.transaction_date else excluded.transaction_date end,
      created_by = excluded.created_by,
      voided_at = null,
      voided_by = null;
  else
    update public.shirt_finance_transactions set voided_at=coalesce(voided_at,now()), voided_by=coalesce(voided_by,v_actor)
      where shirt_order_id=new.id and payment_stage='remainder' and voided_at is null;
  end if;
  return new;
end;
$$;
revoke all on function public.sync_shirt_order_finance_transactions() from public;
create trigger sync_shirt_order_finance_transactions
  after insert or update of paid, half_paid, quantity, model on public.shirt_orders
  for each row execute function public.sync_shirt_order_finance_transactions();
