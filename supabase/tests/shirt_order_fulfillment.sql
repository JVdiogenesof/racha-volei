-- All fixture changes are rolled back; no real order/payment is persisted.
begin;
select set_config('test.shirt_admin', (select id::text from public.profiles where is_organizer and status='approved' limit 1), true);
select set_config('test.shirt_order', (select o.id::text from public.shirt_orders o join public.profiles p on p.id=o.profile_id where not p.is_organizer and p.status='approved' limit 1), true);
select set_config('test.shirt_owner', (select profile_id::text from public.shirt_orders where id=current_setting('test.shirt_order')::uuid), true);
create temporary table shirt_status_cash_before on commit drop as
select 'shirts' as ledger, md5(coalesce(jsonb_agg(to_jsonb(t) order by t.id)::text,'')) as digest from public.shirt_finance_transactions t
union all select 'racha', md5(coalesce(jsonb_agg(to_jsonb(t) order by t.id)::text,'')) from public.finance_transactions t;
select set_config('request.jwt.claim.sub', current_setting('test.shirt_admin'), true);
set local role authenticated;
do $$
declare stage text;
begin
  if auth.uid() is null or nullif(current_setting('test.shirt_order'),'') is null then raise exception 'TEST: missing fixtures'; end if;
  foreach stage in array array['ordered','delivered','awaiting_payment','ordered'] loop
    update public.shirt_orders set fulfillment_status=stage where id=current_setting('test.shirt_order')::uuid;
    if not exists(select 1 from public.shirt_orders where id=current_setting('test.shirt_order')::uuid and fulfillment_status=stage) then raise exception 'TEST: organizer update failed'; end if;
  end loop;
  begin
    update public.shirt_orders set fulfillment_status='invalid' where id=current_setting('test.shirt_order')::uuid;
    raise exception 'TEST: invalid status accepted';
  exception when check_violation then null;
  end;
end $$;
select set_config('request.jwt.claim.sub', current_setting('test.shirt_owner'), true);
do $$
begin
  if not exists(select 1 from public.shirt_orders where id=current_setting('test.shirt_order')::uuid and fulfillment_status='ordered') then raise exception 'TEST: owner cannot read status'; end if;
  begin
    update public.shirt_orders set fulfillment_status='delivered' where id=current_setting('test.shirt_order')::uuid;
    raise exception 'TEST: owner changed status';
  exception when raise_exception then if SQLERRM like 'TEST:%' then raise; end if; end;
  begin
    update public.shirt_orders set fit=case when fit='female' then 'regular' else 'female' end where id=current_setting('test.shirt_order')::uuid;
    raise exception 'TEST: owner changed manufactured item';
  exception when raise_exception then if SQLERRM like 'TEST:%' then raise; end if; end;
  begin
    delete from public.shirt_orders where id=current_setting('test.shirt_order')::uuid;
  exception when raise_exception then if SQLERRM like 'TEST:%' then raise; end if; end;
  if not exists(select 1 from public.shirt_orders where id=current_setting('test.shirt_order')::uuid) then raise exception 'TEST: owner deleted manufactured item'; end if;
  begin
    insert into public.shirt_orders(profile_id,model,community,shirt_name,shirt_number,size,quantity,fulfillment_status)
    select profile_id,model,community,'TEST',1,'M',1,'delivered' from public.shirt_orders where id=current_setting('test.shirt_order')::uuid;
    raise exception 'TEST: owner inserted forged status';
  exception when raise_exception then if SQLERRM like 'TEST:%' then raise; end if; end;
end $$;
reset role;
do $$
begin
  if exists(
    (select 'shirts',md5(coalesce(jsonb_agg(to_jsonb(t) order by t.id)::text,'')) from public.shirt_finance_transactions t
     union all select 'racha',md5(coalesce(jsonb_agg(to_jsonb(t) order by t.id)::text,'')) from public.finance_transactions t)
     except select ledger,digest from shirt_status_cash_before
  ) then raise exception 'TEST: status affected financial ledger'; end if;
end $$;
rollback;
select 'PASS: organizer status, validation, owner read, protected writes/deletes/inserts, both ledgers unchanged; rollback completed' as result;
