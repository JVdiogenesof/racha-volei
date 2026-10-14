-- Ajustes manuais ligados a um racha e metrica de derrotas, usados pelo Indice VPA.
-- Aditivo: ajustes existentes continuam com event_id nulo e nada muda para eles.
alter type public.ranking_metric add value if not exists 'losses';
alter table public.ranking_adjustments add column if not exists event_id uuid references public.events(id) on delete cascade;
create index if not exists ranking_adjustments_event_idx on public.ranking_adjustments (event_id) where event_id is not null;
