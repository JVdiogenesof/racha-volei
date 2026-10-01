alter table public.shirt_orders
  add column if not exists community text not null default 'court';

alter table public.shirt_orders
  drop constraint if exists shirt_orders_community_valid;

alter table public.shirt_orders
  add constraint shirt_orders_community_valid
  check (community in ('court', 'sand'));

alter table public.shirt_orders
  drop constraint if exists shirt_orders_profile_model_unique;

alter table public.shirt_orders
  drop constraint if exists shirt_orders_profile_model_community_unique;

alter table public.shirt_orders
  add constraint shirt_orders_profile_model_community_unique
  unique (profile_id, model, community);

drop index if exists public.shirt_orders_paid_created_idx;

create index if not exists shirt_orders_community_paid_created_idx
  on public.shirt_orders (community, paid, created_at);
