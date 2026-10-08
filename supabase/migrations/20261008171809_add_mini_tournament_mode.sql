alter table public.events
  add column if not exists is_mini_torneio boolean not null default false;

alter table public.events
  drop constraint if exists events_single_tournament_style_check;

alter table public.events
  add constraint events_single_tournament_style_check
  check (not (is_pre_torneio and is_mini_torneio));
