alter table public.events
  add column if not exists registration_opens_at timestamptz;

comment on column public.events.registration_opens_at is
  'Date and time when players may start registering interest. Null preserves legacy events as immediately open.';
