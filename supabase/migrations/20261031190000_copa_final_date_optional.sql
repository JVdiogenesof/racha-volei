-- A data da final da Copa VPA pode ficar "a definir": nula até a
-- organização escolher o dia (ou o racha da final, que traz a data junto).
alter table public.cups alter column final_date drop not null;

-- A Copa VPA de novembro/2026 ainda não tem data de final decidida.
update public.cups
set final_date = null
where name = 'Copa VPA'
  and final_date = date '2026-11-29'
  and final_event_id is null;
