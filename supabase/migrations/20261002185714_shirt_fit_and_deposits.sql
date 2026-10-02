begin;
alter table public.shirt_orders
  add column fit text not null default 'unspecified' check (fit in ('unspecified', 'regular', 'female')),
  add column half_paid boolean not null default false;

alter table public.shirt_orders drop constraint shirt_orders_payment_state_check;
alter table public.shirt_orders add constraint shirt_orders_payment_state_check check (
  not (paid and half_paid) and (
    ((paid or half_paid) and paid_at is not null and marked_by is not null)
    or (not paid and not half_paid and paid_at is null and marked_by is null)
  )
);

-- Ownership stays enforced by RLS. This invoker trigger limits what owners
-- can edit after paying and prevents self-confirming any payment.
create or replace function public.guard_shirt_order_changes()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is not null and not public.is_organizer() then
    if (to_jsonb(new) - array['fit','updated_at']) is distinct from
       (to_jsonb(old) - array['fit','updated_at']) and (old.paid or old.half_paid) then
      raise exception 'Pedido com pagamento: somente a modelagem pode ser alterada.';
    end if;
    if row(new.id,new.profile_id,new.community,new.model,new.paid,new.half_paid,new.paid_at,new.marked_by,new.created_at)
      is distinct from row(old.id,old.profile_id,old.community,old.model,old.paid,old.half_paid,old.paid_at,old.marked_by,old.created_at) then
      raise exception 'Somente organizadores podem alterar pagamentos ou a identificação do pedido.';
    end if;
  end if;
  return new;
end;
$$;
create trigger guard_shirt_order_changes before update on public.shirt_orders
  for each row execute function public.guard_shirt_order_changes();
revoke all on function public.guard_shirt_order_changes() from public;

alter policy "shirt_orders_insert_own" on public.shirt_orders
  with check (profile_id = auth.uid() and public.is_full_member()
    and not paid and not half_paid and paid_at is null and marked_by is null);
alter policy "shirt_orders_update_own_or_organizer" on public.shirt_orders
  using (public.is_organizer() or (profile_id = auth.uid() and public.is_full_member()))
  with check (public.is_organizer() or (profile_id = auth.uid() and public.is_full_member()));
alter policy "shirt_orders_delete_own_or_organizer" on public.shirt_orders
  using (public.is_organizer() or (profile_id = auth.uid() and public.is_full_member() and not paid and not half_paid));
commit;
