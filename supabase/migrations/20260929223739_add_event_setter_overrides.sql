create table if not exists public.event_setter_overrides (
  event_id uuid not null,
  profile_id uuid not null,
  is_setter boolean not null,
  changed_by uuid not null references public.profiles(id),
  updated_at timestamptz not null default now(),
  primary key (event_id, profile_id),
  constraint event_setter_overrides_attendance_fkey
    foreign key (event_id, profile_id)
    references public.attendance(event_id, profile_id)
    on delete cascade
);

alter table public.event_setter_overrides enable row level security;

grant select, insert, update, delete on public.event_setter_overrides to authenticated;

create policy "event_setter_overrides_select"
on public.event_setter_overrides
for select
to authenticated
using (true);

create policy "event_setter_overrides_write"
on public.event_setter_overrides
for all
to authenticated
using (public.is_organizer())
with check (public.is_organizer() and changed_by = (select auth.uid()));
