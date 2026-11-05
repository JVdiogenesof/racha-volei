-- Regra do organizador: a fila de interessados só vale quando a lista está
-- cheia. Com vagas sobrando, qualquer pessoa pode entrar direto.
--
-- 1. advance_spot_offer só chama alguém quando sobra exatamente 1 vaga (a lista
--    estava cheia e alguém saiu). Com 2 ou mais livres, não existe fila.
-- 2. Oferta de quem já saiu dos interessados (ex.: removido pela organização)
--    é encerrada, em vez de continuar segurando a vaga até vencer.
-- 3. has_active_spot_offer ignora essa oferta sem dono.
create or replace function public.advance_spot_offer(p_event_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_event public.events%rowtype;
  v_capacity integer;
  v_confirmed integer;
  v_pending public.spot_offers%rowtype;
  v_next_profile_id uuid;
begin
  select * into v_event from public.events where id = p_event_id for update;
  if not found or v_event.status in ('finished', 'cancelled') then
    return null;
  end if;

  -- Oferta pendente vencida, ou de quem nem está mais interessado: encerra e
  -- tira a pessoa da lista de interessados.
  select * into v_pending from public.spot_offers s
    where s.event_id = p_event_id and s.status = 'pending'
      and (
        s.expires_at <= now()
        or not exists (
          select 1 from public.attendance a
          where a.event_id = p_event_id and a.profile_id = s.profile_id and a.status = 'interested'
        )
      )
    for update;
  if found then
    update public.spot_offers set status = 'expired', resolved_at = now() where id = v_pending.id;
    update public.attendance set status = 'declined', cancelled_at = now()
      where event_id = p_event_id and profile_id = v_pending.profile_id and status = 'interested';
  end if;

  -- Já existe oferta pendente em aberto (não vencida): não faz nada agora.
  if exists (
    select 1 from public.spot_offers
    where event_id = p_event_id and status = 'pending' and expires_at > now()
  ) then
    return null;
  end if;

  -- Times já sorteados ou racha em andamento: não chama mais ninguém novo
  -- sozinho -- quem entrar agora não teria time nenhum.
  if v_event.status in ('teams_generated', 'in_progress') then
    return null;
  end if;

  v_capacity := coalesce(v_event.max_players, v_event.num_teams * v_event.team_size);
  select count(*) into v_confirmed from public.attendance where event_id = p_event_id and status = 'confirmed';
  -- A fila só vale com a lista cheia: lotada não há o que oferecer, e com 2 ou
  -- mais vagas livres qualquer pessoa pode entrar direto.
  if v_capacity - v_confirmed <> 1 then
    return null;
  end if;

  select a.profile_id into v_next_profile_id
    from public.attendance a
    join public.profiles p on p.id = a.profile_id
    where a.event_id = p_event_id and a.status = 'interested'
      and (p.status = 'approved' or (p.status = 'guest' and p.guest_for_event_id = p_event_id))
      and not exists (select 1 from public.spot_offers so where so.event_id = p_event_id and so.profile_id = a.profile_id)
    order by a.confirmed_at asc
    limit 1;

  if v_next_profile_id is null then
    return null;
  end if;

  insert into public.spot_offers (event_id, profile_id, status, offered_at, expires_at)
  values (p_event_id, v_next_profile_id, 'pending', now(), now() + interval '1 hour');

  return v_next_profile_id;
end;
$function$;

create or replace function public.has_active_spot_offer(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from public.spot_offers s
    join public.attendance a on a.event_id = s.event_id and a.profile_id = s.profile_id and a.status = 'interested'
    where s.event_id = p_event_id and s.status = 'pending' and s.expires_at > now()
  );
$function$;
