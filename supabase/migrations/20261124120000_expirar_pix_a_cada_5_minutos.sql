-- Menos logs no plano gratuito: a tarefa que marca como "vencidas" as reservas
-- de Pix não pagas passa de 1 em 1 minuto para 5 em 5 minutos.
-- Não muda nada para quem usa o site: contador de vagas, lista e avisos já
-- ignoram reservas com reservation_expires_at no passado, então a vaga volta
-- na hora; a tarefa só troca a etiqueta no banco. As notificações agendadas
-- (trigger_due_notifications) continuam de 1 em 1 minuto.
select cron.alter_job(
  job_id := (select jobid from cron.job where command ilike '%expire_event_payment_reservations%' limit 1),
  schedule := '*/5 * * * *'
);
