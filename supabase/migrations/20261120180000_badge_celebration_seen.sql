-- Comemoração de medalha entregue pelo organizador: cada medalha guarda quando
-- a pessoa já viu a animação. Aditiva.
alter table public.profile_badges add column if not exists seen_at timestamptz;

-- Medalhas entregues antes de 20/11/2026 (horário de Fortaleza) contam como já vistas:
-- só as de hoje e as futuras mostram a animação.
update public.profile_badges
set seen_at = awarded_at
where seen_at is null
  and (awarded_at at time zone 'America/Fortaleza')::date < date '2026-11-20';

-- A pessoa só marca as próprias medalhas como vistas (sem abrir update na tabela).
create or replace function public.mark_badges_seen(p_award_ids uuid[])
returns void
language sql
security definer
set search_path = public
as $$
  update public.profile_badges
  set seen_at = now()
  where id = any(p_award_ids) and profile_id = auth.uid() and seen_at is null;
$$;

revoke all on function public.mark_badges_seen(uuid[]) from public, anon;
grant execute on function public.mark_badges_seen(uuid[]) to authenticated;
