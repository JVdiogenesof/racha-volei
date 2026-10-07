-- O caixa de camisas também precisa registrar entradas e saídas que não
-- pertencem a um pedido específico, sem se misturar ao caixa dos rachas.
alter table public.shirt_finance_transactions
  add column transaction_type text not null default 'income'
  constraint shirt_finance_transactions_type_check check (transaction_type in ('income', 'expense'));

alter table public.shirt_finance_transactions
  drop constraint if exists shirt_finance_transactions_payment_stage_check;

alter table public.shirt_finance_transactions
  add constraint shirt_finance_transactions_payment_stage_check
  check (payment_stage in ('deposit', 'remainder', 'manual'));
