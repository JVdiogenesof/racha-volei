-- Corrige o alias usado pela trava de classificados em pré-torneios.
create or replace function public.enforce_pre_tournament_eligibility()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events%rowtype;
begin
  if new.status not in ('interested', 'confirmed') then
    return new;
  end if;

  select * into v_event from public.events where id = new.event_id;
  if not found or not v_event.is_pre_torneio then
    return new;
  end if;

  if exists (
    select 1
    from public.tournament_reserved_players qualified
    where qualified.profile_id = new.profile_id
      and qualified.community = v_event.community
  ) and not exists (
    select 1
    from public.pre_tournament_eligibility_exceptions eligible_exception
    where eligible_exception.event_id = new.event_id
      and eligible_exception.profile_id = new.profile_id
  ) then
    raise exception 'Você já está classificado(a) para o Torneio VPA e não pode entrar neste pré-torneio.';
  end if;

  return new;
end;
$$;
