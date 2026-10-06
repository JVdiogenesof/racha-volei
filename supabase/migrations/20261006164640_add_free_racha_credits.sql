create table public.free_racha_credits (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  community text not null default 'court' check (community in ('court', 'sand')),
  reason text not null check (char_length(trim(reason)) between 1 and 120),
  notes text check (notes is null or char_length(notes) <= 500),
  status text not null default 'available' check (status in ('available', 'used', 'cancelled')),
  granted_by uuid not null references public.profiles(id),
  granted_at timestamptz not null default now(),
  used_event_id uuid references public.events(id) on delete set null,
  used_by uuid references public.profiles(id) on delete set null,
  used_at timestamptz,
  cancelled_by uuid references public.profiles(id) on delete set null,
  cancelled_at timestamptz,
  constraint free_racha_credits_status_details_check check (
    (status = 'available' and used_event_id is null and used_by is null and used_at is null and cancelled_by is null and cancelled_at is null)
    or (status = 'used' and used_by is not null and used_at is not null and cancelled_by is null and cancelled_at is null)
    or (status = 'cancelled' and used_event_id is null and used_by is null and used_at is null and cancelled_by is not null and cancelled_at is not null)
  )
);

create index free_racha_credits_community_status_granted_idx
  on public.free_racha_credits (community, status, granted_at desc);
create index free_racha_credits_profile_community_idx
  on public.free_racha_credits (profile_id, community);

alter table public.free_racha_credits enable row level security;

create policy "free_racha_credits_select_organizer"
  on public.free_racha_credits for select to authenticated
  using ((select public.is_organizer()));

create policy "free_racha_credits_insert_organizer"
  on public.free_racha_credits for insert to authenticated
  with check ((select public.is_organizer()) and granted_by = (select auth.uid()));

create policy "free_racha_credits_update_organizer"
  on public.free_racha_credits for update to authenticated
  using ((select public.is_organizer()))
  with check ((select public.is_organizer()));

grant select, insert, update on table public.free_racha_credits to authenticated;
