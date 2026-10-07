begin;
alter table public.shirt_orders
  add column fulfillment_status text not null default 'awaiting_payment'
  constraint shirt_orders_fulfillment_status_check check (fulfillment_status in ('awaiting_payment', 'ordered', 'delivered'));

-- Keep production status independent from payment and both finance ledgers.
-- Existing RLS still enforces ownership and organizer access.
create or replace function public.guard_shirt_order_fulfillment()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is not null and not public.is_organizer() then
    if TG_OP = 'INSERT' then
      if new.fulfillment_status <> 'awaiting_payment' then
        raise exception 'Somente organizadores podem alterar o andamento do pedido.';
      end if;
    elsif TG_OP = 'DELETE' then
      if old.fulfillment_status <> 'awaiting_payment' then
        raise exception 'Pedido enviado à loja ou entregue. Fale com um organizador.';
      end if;
    else
      if new.fulfillment_status is distinct from old.fulfillment_status then
        raise exception 'Somente organizadores podem alterar o andamento do pedido.';
      end if;
      if old.fulfillment_status <> 'awaiting_payment' and
        (to_jsonb(new) - 'updated_at') is distinct from (to_jsonb(old) - 'updated_at') then
        raise exception 'Pedido enviado à loja ou entregue. Fale com um organizador.';
      end if;
    end if;
  end if;
  if TG_OP = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger guard_shirt_order_fulfillment before insert or update or delete on public.shirt_orders
  for each row execute function public.guard_shirt_order_fulfillment();
revoke all on function public.guard_shirt_order_fulfillment() from public;
commit;
