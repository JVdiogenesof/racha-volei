-- Isenção de pagamento: JV e Vidal não pagam racha. Quando entram
-- confirmados numa lista, o pagamento é registrado automaticamente como
-- pago, com origem 'exempt' -- sem lançamento de entrada no caixa (o
-- gatilho sync_payment_finance_transaction só lança 'cash' e 'pix').
--
-- A isenção fica numa tabela própria, sem policy de escrita: o perfil pode
-- ser editado pelo próprio usuário, e aqui ninguém se autoisenta pelo app.
-- Só migração muda essa lista.
--
-- Aditiva: tabela nova, 'exempt' a mais no check de payment_source e um
-- gatilho novo em attendance. Nenhuma função existente é alterada.

create table if not exists public.payment_exempt_profiles (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  note text,
  created_at timestamptz not null default now()
);

alter table public.payment_exempt_profiles enable row level security;

create policy payment_exempt_profiles_select on public.payment_exempt_profiles
  for select to authenticated
  using (profile_id = (select auth.uid()) or (select public.is_organizer()));

insert into public.payment_exempt_profiles (profile_id, note) values
  ('ea6c4b3a-a774-4ccd-a705-c14220193812', 'JV -- organização, não paga racha'),
  ('8048d01b-6fca-4b92-afb4-22677d392d47', 'Vidal -- organização, não paga racha')
on conflict (profile_id) do nothing;

alter table public.payments drop constraint payments_payment_source_check;
alter table public.payments add constraint payments_payment_source_check
  check (payment_source = any (array['cash', 'balance', 'pix', 'exempt']));

create or replace function public.mark_exempt_attendance_paid()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'confirmed'
     and (tg_op = 'INSERT' or old.status is distinct from 'confirmed')
     and exists (select 1 from public.payment_exempt_profiles e where e.profile_id = new.profile_id) then
    -- Pagamento de verdade já registrado (ex.: pagou Pix antes da isenção)
    -- fica como está; só completa quando ainda não tinha pago.
    insert into public.payments (event_id, profile_id, paid, paid_at, amount, payment_source)
    values (new.event_id, new.profile_id, true, now(), null, 'exempt')
    on conflict (event_id, profile_id) do update set
      paid = true, paid_at = now(), amount = null, payment_source = 'exempt', balance_entry_id = null
    where public.payments.paid = false;
  end if;
  return new;
end;
$$;

drop trigger if exists attendance_mark_exempt_paid on public.attendance;
create trigger attendance_mark_exempt_paid
  after insert or update of status on public.attendance
  for each row execute function public.mark_exempt_attendance_paid();

-- Quem já está confirmado agora em racha aberto e ainda não pagou.
insert into public.payments (event_id, profile_id, paid, paid_at, amount, payment_source)
select a.event_id, a.profile_id, true, now(), null, 'exempt'
from public.attendance a
join public.payment_exempt_profiles e on e.profile_id = a.profile_id
join public.events ev on ev.id = a.event_id
where a.status = 'confirmed' and ev.status in ('open', 'teams_generated', 'in_progress')
on conflict (event_id, profile_id) do update set
  paid = true, paid_at = now(), amount = null, payment_source = 'exempt', balance_entry_id = null
where public.payments.paid = false;
