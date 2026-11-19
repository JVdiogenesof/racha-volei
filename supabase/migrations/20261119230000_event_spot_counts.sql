-- Contagem única de vagas de um racha para as telas (início, racha e lista).
-- Migração aditiva: só cria uma função de leitura.
--
-- "Ocupada" = confirmada + reservada por um Pix ainda válido (a reserva segura
-- a vaga por 5 minutos). Antes as telas só contavam confirmadas e mostravam
-- mais vagas livres do que as realmente disponíveis. Só devolve totais, sem
-- dados de quem reservou.
create or replace function public.event_spot_counts(p_event_id uuid)
returns table (
  confirmed_total integer,
  confirmed_setters integer,
  reserved_total integer,
  reserved_setters integer,
  capacity integer,
  first_batch_spots integer,
  second_batch_opens_at timestamptz,
  server_now timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*) from public.attendance a where a.event_id = e.id and a.status = 'confirmed')::integer,
    (select count(*) from public.attendance a where a.event_id = e.id and a.status = 'confirmed' and a.uses_setter_spot)::integer,
    (select count(*) from public.event_payment_intents i
      where i.event_id = e.id and i.status = 'pending' and i.reserves_capacity and i.reservation_expires_at > now())::integer,
    (select count(*) from public.event_payment_intents i
      where i.event_id = e.id and i.status = 'pending' and i.reserves_capacity and i.reservation_expires_at > now() and i.uses_setter_spot)::integer,
    coalesce(e.max_players, e.num_teams * e.team_size),
    e.first_batch_spots,
    e.second_batch_opens_at,
    now()
  from public.events e
  where e.id = p_event_id;
$$;

revoke all on function public.event_spot_counts(uuid) from public, anon;
grant execute on function public.event_spot_counts(uuid) to authenticated;
