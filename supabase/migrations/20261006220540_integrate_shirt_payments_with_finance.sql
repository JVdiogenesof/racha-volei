-- Cada pedido possui dois recebimentos possíveis: entrada de 50% e quitação.
-- Regata custa R$ 37,00 e camisa com manga custa R$ 41,00 por peça.
alter table public.finance_transactions
  drop constraint if exists finance_transactions_category_check;
alter table public.finance_transactions
  add constraint finance_transactions_category_check
    check (category in ('event_payment', 'shirt_sale', 'sponsorship', 'court_rental', 'medals', 'balance', 'other')),
  add column shirt_order_id uuid references public.shirt_orders(id) on delete set null,
  add column shirt_payment_stage text check (shirt_payment_stage in ('deposit', 'remainder'));

alter table public.finance_transactions
  add constraint finance_transactions_shirt_stage_check check (
    (shirt_order_id is null and shirt_payment_stage is null)
    or (shirt_order_id is not null and shirt_payment_stage is not null)
  );

create unique index finance_transactions_shirt_order_stage_unique
  on public.finance_transactions (shirt_order_id, shirt_payment_stage)
  where shirt_order_id is not null;

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
    insert into public.finance_transactions (
      community, transaction_type, category, description, amount, transaction_date,
      profile_id, shirt_order_id, shirt_payment_stage, created_by, voided_at, voided_by
    ) values (
      new.community, 'income', 'shirt_sale', v_model_label || ' · entrada de 50%', v_half,
      (coalesce(new.paid_at, now()) at time zone 'America/Fortaleza')::date,
      new.profile_id, new.id, 'deposit', v_actor, null, null
    )
    on conflict (shirt_order_id, shirt_payment_stage) where shirt_order_id is not null do update set
      amount = excluded.amount,
      transaction_date = case when finance_transactions.voided_at is null then finance_transactions.transaction_date else excluded.transaction_date end,
      created_by = excluded.created_by,
      voided_at = null,
      voided_by = null;
  else
    update public.finance_transactions set voided_at=coalesce(voided_at,now()), voided_by=coalesce(voided_by,v_actor)
      where shirt_order_id=new.id and shirt_payment_stage='deposit' and voided_at is null;
  end if;

  if new.paid then
    insert into public.finance_transactions (
      community, transaction_type, category, description, amount, transaction_date,
      profile_id, shirt_order_id, shirt_payment_stage, created_by, voided_at, voided_by
    ) values (
      new.community, 'income', 'shirt_sale', v_model_label || ' · quitação', v_half,
      (coalesce(new.paid_at, now()) at time zone 'America/Fortaleza')::date,
      new.profile_id, new.id, 'remainder', v_actor, null, null
    )
    on conflict (shirt_order_id, shirt_payment_stage) where shirt_order_id is not null do update set
      amount = excluded.amount,
      transaction_date = case when finance_transactions.voided_at is null then finance_transactions.transaction_date else excluded.transaction_date end,
      created_by = excluded.created_by,
      voided_at = null,
      voided_by = null;
  else
    update public.finance_transactions set voided_at=coalesce(voided_at,now()), voided_by=coalesce(voided_by,v_actor)
      where shirt_order_id=new.id and shirt_payment_stage='remainder' and voided_at is null;
  end if;

  return new;
end;
$$;
revoke all on function public.sync_shirt_order_finance_transactions() from public;

drop trigger if exists sync_shirt_order_finance_transactions on public.shirt_orders;
create trigger sync_shirt_order_finance_transactions
  after insert or update of paid, half_paid, quantity, model on public.shirt_orders
  for each row execute function public.sync_shirt_order_finance_transactions();

-- Importa os pagamentos de camisa já marcados antes desta integração.
insert into public.finance_transactions (
  community, transaction_type, category, description, amount, transaction_date,
  profile_id, shirt_order_id, shirt_payment_stage, created_by
)
select o.community, 'income', 'shirt_sale',
       (case when o.model='tank' then 'Regata' else 'Camisa com manga' end) || ' · entrada de 50%',
       ((case when o.model='tank' then 37 else 41 end) * o.quantity) / 2.0,
       (o.paid_at at time zone 'America/Fortaleza')::date,
       o.profile_id, o.id, 'deposit', o.marked_by
from public.shirt_orders o
where o.paid or o.half_paid
on conflict (shirt_order_id, shirt_payment_stage) where shirt_order_id is not null do nothing;

insert into public.finance_transactions (
  community, transaction_type, category, description, amount, transaction_date,
  profile_id, shirt_order_id, shirt_payment_stage, created_by
)
select o.community, 'income', 'shirt_sale',
       (case when o.model='tank' then 'Regata' else 'Camisa com manga' end) || ' · quitação',
       ((case when o.model='tank' then 37 else 41 end) * o.quantity) / 2.0,
       (o.paid_at at time zone 'America/Fortaleza')::date,
       o.profile_id, o.id, 'remainder', o.marked_by
from public.shirt_orders o
where o.paid
on conflict (shirt_order_id, shirt_payment_stage) where shirt_order_id is not null do nothing;
