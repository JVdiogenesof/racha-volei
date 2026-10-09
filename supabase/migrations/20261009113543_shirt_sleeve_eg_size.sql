begin;

alter table public.shirt_orders
  drop constraint if exists shirt_orders_size_check;

alter table public.shirt_orders
  add constraint shirt_orders_size_check check (
    size in ('PP', 'P', 'M', 'G', 'GG')
    or (model = 'sleeve' and fit = 'regular' and size = 'EG')
  );

commit;
