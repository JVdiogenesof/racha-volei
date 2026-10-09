-- O Supabase Cron executa estes trabalhos dentro do Postgres, sem depender de
-- alguém abrir o app. Os horários do pg_cron são UTC (04:20 = 01:20 em Fortaleza).
create extension if not exists pg_cron;

select cron.schedule(
  'expire-event-payment-reservations',
  '* * * * *',
  $$select public.expire_event_payment_reservations();$$
);

select cron.schedule(
  'purge-old-event-payment-records',
  '20 4 * * *',
  $$select public.purge_old_event_payment_records();$$
);

-- O histórico de execução do cron também é temporário para não crescer sem necessidade.
select cron.schedule(
  'purge-pix-cron-run-history',
  '45 4 * * *',
  $$delete from cron.job_run_details where end_time < now() - interval '7 days';$$
);
