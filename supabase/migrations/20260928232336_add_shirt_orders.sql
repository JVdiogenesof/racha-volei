create table public.shirt_orders (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  model text not null check (model in ('tank', 'sleeve')),
  shirt_name text not null check (char_length(btrim(shirt_name)) between 1 and 20),
  shirt_number integer not null check (shirt_number between 0 and 99),
  size text not null check (size in ('PP', 'P', 'M', 'G', 'GG')),
  quantity integer not null default 1 check (quantity between 1 and 20),
  paid boolean not null default false,
  paid_at timestamptz,
  marked_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shirt_orders_profile_model_unique unique (profile_id, model),
  constraint shirt_orders_payment_state_check check (
    (paid and paid_at is not null and marked_by is not null)
    or (not paid and paid_at is null and marked_by is null)
  )
);

create index shirt_orders_paid_created_idx on public.shirt_orders (paid, created_at);

alter table public.shirt_orders enable row level security;

create policy "shirt_orders_select" on public.shirt_orders
  for select to authenticated
  using (profile_id = auth.uid() or public.is_organizer());

create policy "shirt_orders_insert_own" on public.shirt_orders
  for insert to authenticated
  with check (
    profile_id = auth.uid()
    and public.is_full_member()
    and paid = false
    and paid_at is null
    and marked_by is null
  );

create policy "shirt_orders_update_own_or_organizer" on public.shirt_orders
  for update to authenticated
  using (
    public.is_organizer()
    or (profile_id = auth.uid() and public.is_full_member() and paid = false)
  )
  with check (
    public.is_organizer()
    or (
      profile_id = auth.uid()
      and public.is_full_member()
      and paid = false
      and paid_at is null
      and marked_by is null
    )
  );

create policy "shirt_orders_delete_own_or_organizer" on public.shirt_orders
  for delete to authenticated
  using (
    public.is_organizer()
    or (profile_id = auth.uid() and public.is_full_member() and paid = false)
  );
