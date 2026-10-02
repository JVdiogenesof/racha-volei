-- Exercises RLS using existing profile IDs, inside a transaction that is
-- always rolled back. No real order changes persist.
begin;
select set_config('test.shirt_owner', (
  select s.profile_id::text from public.shirt_orders s join public.profiles p on p.id=s.profile_id
  where p.status='approved' and not p.is_organizer limit 1
), true);
select set_config('test.shirt_admin', (
  select id::text from public.profiles where is_organizer and status='approved' limit 1
), true);
select set_config('test.shirt_order', (
  select id::text from public.shirt_orders where profile_id=current_setting('test.shirt_owner')::uuid limit 1
), true);

select set_config('request.jwt.claim.sub', current_setting('test.shirt_admin'), true);
set local role authenticated;
update public.shirt_orders set paid=false, half_paid=true, paid_at=now(),
  marked_by=auth.uid() where id=current_setting('test.shirt_order')::uuid;
do $$ begin
  if not exists(select 1 from public.shirt_orders where id=current_setting('test.shirt_order')::uuid and half_paid and not paid)
  then raise exception 'TEST: organizer failed to mark deposit'; end if;
end $$;

select set_config('request.jwt.claim.sub', current_setting('test.shirt_owner'), true);
update public.shirt_orders set fit='female' where id=current_setting('test.shirt_order')::uuid;
do $$
declare affected integer;
begin
  if not exists(select 1 from public.shirt_orders where id=current_setting('test.shirt_order')::uuid and fit='female' and half_paid)
  then raise exception 'TEST: owner fit update failed'; end if;
  begin
    update public.shirt_orders set half_paid=false,paid=true where id=current_setting('test.shirt_order')::uuid;
    raise exception 'TEST: owner self-confirmed full payment';
  exception when raise_exception then
    if SQLERRM like 'TEST:%' then raise; end if;
  end;
  begin
    update public.shirt_orders set quantity=case when quantity=1 then 2 else 1 end where id=current_setting('test.shirt_order')::uuid;
    raise exception 'TEST: paid quantity changed';
  exception when raise_exception then
    if SQLERRM like 'TEST:%' then raise; end if;
  end;
  delete from public.shirt_orders where id=current_setting('test.shirt_order')::uuid;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'TEST: deposit item deleted by owner'; end if;
  update public.shirt_orders set fit='female' where profile_id<>auth.uid();
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'TEST: other owners exposed'; end if;
end $$;

select set_config('request.jwt.claim.sub', current_setting('test.shirt_admin'), true);
update public.shirt_orders set paid=true,half_paid=false,paid_at=now(),marked_by=auth.uid()
  where id=current_setting('test.shirt_order')::uuid;
select set_config('request.jwt.claim.sub', current_setting('test.shirt_owner'), true);
update public.shirt_orders set fit='regular' where id=current_setting('test.shirt_order')::uuid;
do $$ begin
  if not exists(select 1 from public.shirt_orders where id=current_setting('test.shirt_order')::uuid and paid and not half_paid and fit='regular')
  then raise exception 'TEST: full payment or fit after payment failed'; end if;
end $$;

select set_config('request.jwt.claim.sub', current_setting('test.shirt_admin'), true);
update public.shirt_orders set paid=false,half_paid=false,paid_at=null,marked_by=null
  where id=current_setting('test.shirt_order')::uuid;
select set_config('request.jwt.claim.sub', current_setting('test.shirt_owner'), true);
update public.shirt_orders set size='M' where id=current_setting('test.shirt_order')::uuid;
do $$ begin
  if not exists(select 1 from public.shirt_orders where id=current_setting('test.shirt_order')::uuid and not paid and not half_paid and size='M')
  then raise exception 'TEST: unpaid item edit failed'; end if;
  begin
    update public.shirt_orders set half_paid=true,paid_at=now(),marked_by=auth.uid()
      where id=current_setting('test.shirt_order')::uuid;
    raise exception 'TEST: owner self-confirmed deposit';
  exception when raise_exception then
    if SQLERRM like 'TEST:%' then raise; end if;
  end;
end $$;
rollback;
