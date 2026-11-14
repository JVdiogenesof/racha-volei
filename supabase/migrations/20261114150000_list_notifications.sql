-- Notificações automáticas de lista (abertura, Lote 2, lembretes, lista lotada...).
--
-- Como funciona:
--   * public.pending_event_notifications() diz quais avisos estão "na hora" e
--     ainda não foram enviados (um aviso por racha por tipo).
--   * Um job do pg_cron roda a cada minuto e, SÓ quando existe algo pendente,
--     chama /api/cron/notifications no app (via pg_net). O app reserva o aviso
--     em public.notification_dispatches (chave única) e manda o push.
--   * Janelas curtas: um aviso que passou da janela sem ser enviado é
--     descartado, nunca dispara atrasado em massa.
-- Aditiva: não altera nada do fluxo de inscrição/pagamento.

create extension if not exists pg_net;

create table if not exists public.notification_dispatches (
  event_id uuid not null references public.events(id) on delete cascade,
  kind text not null,
  sent_at timestamptz not null default now(),
  recipients integer,
  primary key (event_id, kind)
);

alter table public.notification_dispatches enable row level security;
-- Sem policies: só o service role (app no servidor) lê/escreve.
revoke all on public.notification_dispatches from anon, authenticated;

create or replace function public.pending_event_notifications()
returns table (event_id uuid, kind text)
language sql
stable
security definer
set search_path = public
as $$
  with active as (
    select
      e.*,
      ((e.date + coalesce(e.time, time '00:00')) at time zone 'America/Fortaleza') as starts_at,
      ((e.date - 1 + time '19:00') at time zone 'America/Fortaleza') as eve_at,
      (select count(*) from public.attendance a where a.event_id = e.id and a.status = 'confirmed') as confirmed
    from public.events e
    where e.status in ('open', 'teams_generated')
      and e.date >= (now() at time zone 'America/Fortaleza')::date - 1
  ),
  candidates as (
    -- Lista abre em 30 min
    select id, 'list_opening_soon'::text as kind from active
    where registration_opens_at is not null
      and now() >= registration_opens_at - interval '30 minutes'
      and now() < registration_opens_at - interval '20 minutes'
    union all
    -- Lista abriu
    select id, 'list_open' from active
    where registration_opens_at is not null
      and now() >= registration_opens_at
      and now() < registration_opens_at + interval '20 minutes'
      and confirmed < max_players
    union all
    -- Lote 2 abriu
    select id, 'lote2_open' from active
    where second_batch_opens_at is not null and first_batch_spots is not null
      and now() >= second_batch_opens_at
      and now() < second_batch_opens_at + interval '20 minutes'
      and confirmed < max_players
    union all
    -- Lote 1 esgotou (aviso pra quem está na fila de interessados)
    select id, 'lote1_full' from active
    where second_batch_opens_at is not null and first_batch_spots is not null
      and now() < second_batch_opens_at
      and confirmed >= least(first_batch_spots, max_players)
      and confirmed < max_players
    union all
    -- Lista completa (sem lote ativo)
    select id, 'list_full' from active
    where confirmed >= max_players
      and (second_batch_opens_at is null or now() >= second_batch_opens_at)
      and now() < starts_at
    union all
    -- Últimas vagas (1 a 3), só sem lote ativo pra não confundir com vaga de levantador
    select id, 'last_spots' from active
    where (registration_opens_at is null or now() >= registration_opens_at)
      and (second_batch_opens_at is null or now() >= second_batch_opens_at)
      and max_players - confirmed between 1 and 3
      and confirmed > 0
      and now() < starts_at - interval '3 hours'
    union all
    -- Lembrete na véspera, 19:00
    select id, 'reminder_eve' from active
    where now() >= eve_at and now() < eve_at + interval '3 hours' and now() < starts_at and confirmed > 0
    union all
    -- Lembrete 2h antes
    select id, 'reminder_day' from active
    where now() >= starts_at - interval '2 hours' and now() < starts_at - interval '1 hour' and confirmed > 0
  )
  select c.id as event_id, c.kind
  from candidates c
  where not exists (
    select 1 from public.notification_dispatches d where d.event_id = c.id and d.kind = c.kind
  );
$$;

revoke all on function public.pending_event_notifications() from public, anon, authenticated;

-- Situações que JÁ existem agora (ex.: lista que lotou ontem) não disparam
-- aviso atrasado: ficam marcadas como enviadas.
insert into public.notification_dispatches (event_id, kind, recipients)
select event_id, kind, 0
from public.pending_event_notifications()
where kind in ('list_full', 'lote1_full', 'last_spots', 'list_open', 'lote2_open', 'list_opening_soon')
on conflict do nothing;

-- Chamado pelo pg_cron a cada minuto: só acorda o app quando há aviso pendente.
create or replace function public.trigger_due_notifications()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secret text;
begin
  if not exists (select 1 from public.pending_event_notifications()) then
    return;
  end if;
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'notifications_cron_secret';
  if v_secret is null then
    return;
  end if;
  perform net.http_post(
    url := 'https://rachavoleiporamor.com.br/api/cron/notifications',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
end;
$$;

revoke all on function public.trigger_due_notifications() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'dispatch-list-notifications';
select cron.schedule('dispatch-list-notifications', '* * * * *', 'select public.trigger_due_notifications();');

-- Segredo gerado aqui dentro e guardado só no Vault (nunca no Git nem na
-- Vercel). O app confere o token recebido perguntando ao banco.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'notifications_cron_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'notifications_cron_secret', 'Token do pg_cron para /api/cron/notifications');
  end if;
end $$;

create or replace function public.check_notifications_cron_token(p_token text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select decrypted_secret = p_token from vault.decrypted_secrets where name = 'notifications_cron_secret'),
    false
  );
$$;

revoke all on function public.check_notifications_cron_token(text) from public, anon, authenticated;

grant select, insert, update on public.notification_dispatches to service_role;
grant execute on function public.pending_event_notifications() to service_role;
grant execute on function public.check_notifications_cron_token(text) to service_role;
