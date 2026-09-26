create or replace function public.guard_profile_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.status is distinct from old.status
      or new.is_organizer is distinct from old.is_organizer
      or new.approved_by is distinct from old.approved_by)
     and auth.uid() is not null
     and not public.is_organizer()
     and not (
       old.id = auth.uid()
       and old.status = 'guest'
       and new.status = 'visitor'
       and new.guest_for_event_id is null
       and new.approved_by is null
       and new.is_organizer = old.is_organizer
     ) then
    raise exception 'Somente organizadores podem alterar status/aprovação/permissão de organizador.';
  end if;
  return new;
end;
$$;
