do $$
begin
  create type public.player_level as enum ('beginner', 'intermediate', 'advanced');
exception
  when duplicate_object then null;
end
$$;

alter table public.profiles add column if not exists player_level public.player_level;
alter table public.reserve_list add column if not exists player_level public.player_level;

alter table public.profiles drop constraint if exists profiles_guest_for_event_id_fk;
alter table public.profiles
  add constraint profiles_guest_for_event_id_fk
  foreign key (guest_for_event_id) references public.events (id) on delete set null;

-- Quem já estava na reserva ganha o mesmo acesso de visualização sem precisar
-- preencher o cadastro novamente.
insert into public.profiles (id, full_name, phone, status, is_organizer)
select r.auth_user_id, r.full_name, r.phone, 'visitor'::public.profile_status, false
from public.reserve_list r
where not exists (select 1 from public.profiles p where p.id = r.auth_user_id);

create or replace function public.is_approved()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((
    select status in ('approved', 'guest', 'pending', 'visitor')
    from profiles where id = auth.uid()
  ), false);
$$;

create or replace function public.is_full_member()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select status = 'approved' from profiles where id = auth.uid()), false);
$$;

create or replace function public.can_edit_own_profile()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select status in ('pending', 'approved') from profiles where id = auth.uid()), false);
$$;

create or replace function public.can_participate_in_event(target_event_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((
    select status = 'approved'
      or (status = 'guest' and guest_for_event_id = target_event_id)
    from profiles where id = auth.uid()
  ), false);
$$;

create or replace function public.expire_my_guest_access()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update profiles p
  set status = 'visitor', guest_for_event_id = null, approved_by = null
  where p.id = auth.uid()
    and p.status = 'guest'
    and not exists (
      select 1 from events e
      where e.id = p.guest_for_event_id
        and e.status not in ('finished', 'cancelled')
    );
end;
$$;

grant execute on function public.expire_my_guest_access() to authenticated;

drop policy if exists "profiles_insert_visitor_self" on public.profiles;
create policy "profiles_insert_visitor_self" on public.profiles for insert to authenticated
  with check (
    id = auth.uid() and status = 'visitor' and is_organizer = false
    and approved_by is null and guest_for_event_id is null
  );

drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_update" on public.profiles for update to authenticated
  using (public.is_organizer() or (id = auth.uid() and public.can_edit_own_profile()))
  with check (public.is_organizer() or (id = auth.uid() and public.can_edit_own_profile()));

drop policy if exists "self_ratings_write" on public.self_ratings;
create policy "self_ratings_write" on public.self_ratings for all to authenticated
  using ((profile_id = auth.uid() and public.can_edit_own_profile()) or public.is_organizer())
  with check ((profile_id = auth.uid() and public.can_edit_own_profile()) or public.is_organizer());

drop policy if exists "attendance_write" on public.attendance;
create policy "attendance_write" on public.attendance for all to authenticated
  using (public.is_organizer() or (profile_id = auth.uid() and public.can_participate_in_event(event_id)))
  with check (public.is_organizer() or (profile_id = auth.uid() and public.can_participate_in_event(event_id)));

drop policy if exists "mvp_votes_insert" on public.mvp_votes;
create policy "mvp_votes_insert" on public.mvp_votes for insert to authenticated
  with check (voter_profile_id = auth.uid() and public.can_participate_in_event(event_id));

drop policy if exists "reactions_insert" on public.reactions;
create policy "reactions_insert" on public.reactions for insert to authenticated
  with check (from_profile_id = auth.uid() and public.is_full_member());

drop policy if exists "reactions_delete" on public.reactions;
create policy "reactions_delete" on public.reactions for delete to authenticated
  using ((from_profile_id = auth.uid() and public.is_full_member()) or public.is_organizer());

drop policy if exists "queridometro_votes_insert_own" on public.queridometro_votes;
create policy "queridometro_votes_insert_own" on public.queridometro_votes
  for insert to authenticated with check (
    public.is_full_member()
    and from_profile_id = auth.uid() and from_profile_id <> to_profile_id
    and week_start = date_trunc('week', timezone('America/Fortaleza', now()))::date
    and extract(dow from timezone('America/Fortaleza', now())) <> 0
    and exists (select 1 from profiles p where p.id = to_profile_id and p.status = 'approved')
    and exists (select 1 from queridometro_reaction_types t where t.key = reaction_key and t.active)
  );

drop policy if exists "queridometro_votes_update_own" on public.queridometro_votes;
create policy "queridometro_votes_update_own" on public.queridometro_votes
  for update to authenticated using (from_profile_id = auth.uid() and public.is_full_member()) with check (
    public.is_full_member()
    and from_profile_id = auth.uid() and from_profile_id <> to_profile_id
    and week_start = date_trunc('week', timezone('America/Fortaleza', now()))::date
    and extract(dow from timezone('America/Fortaleza', now())) <> 0
    and exists (select 1 from profiles p where p.id = to_profile_id and p.status = 'approved')
    and exists (select 1 from queridometro_reaction_types t where t.key = reaction_key and t.active)
  );

drop policy if exists "queridometro_votes_delete_own" on public.queridometro_votes;
create policy "queridometro_votes_delete_own" on public.queridometro_votes
  for delete to authenticated using (
    public.is_full_member() and from_profile_id = auth.uid()
    and week_start = date_trunc('week', timezone('America/Fortaleza', now()))::date
    and extract(dow from timezone('America/Fortaleza', now())) <> 0
  );

drop policy if exists "push_subscriptions_insert" on public.push_subscriptions;
create policy "push_subscriptions_insert" on public.push_subscriptions for insert to authenticated
  with check (profile_id = auth.uid() and public.is_full_member());

drop policy if exists "push_subscriptions_delete" on public.push_subscriptions;
create policy "push_subscriptions_delete" on public.push_subscriptions for delete to authenticated
  using ((profile_id = auth.uid() and public.is_full_member()) or public.is_organizer());
