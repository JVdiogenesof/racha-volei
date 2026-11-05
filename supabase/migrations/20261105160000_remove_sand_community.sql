-- Pedido do organizador: o racha de areia deixa de existir. Remove pedidos de
-- camisa de areia, quem está só na areia (cadastro e lista de reserva) e a
-- marcação de areia de quem também é da quadra. Depois disso o banco só aceita
-- quadra. Nenhum dado de quadra é apagado.
--
-- Exclusão irreversível, confirmada pelo organizador em 05/11/2026.

delete from public.shirt_orders where community = 'sand';

-- Só areia na reserva: a conta de acesso sai junto quando não há cadastro em
-- uso nem outra entrada de reserva com quadra.
create temporary table sand_only_users on commit drop as
  select id from public.profiles where communities = array['sand']
  union
  select r.auth_user_id from public.reserve_list r
  where r.communities = array['sand'] and r.auth_user_id is not null
    and not exists (select 1 from public.profiles p where p.id = r.auth_user_id and 'court' = any(p.communities));

delete from public.reserve_list where communities = array['sand'];
update public.reserve_list set communities = array['court'] where 'sand' = any(communities);

-- O cadastro e as notas da pessoa saem em cascata com a conta.
delete from auth.users where id in (select id from sand_only_users);

update public.profiles set communities = array['court'] where 'sand' = any(communities);

-- Daqui em diante, só quadra.
alter table public.profiles drop constraint profiles_communities_valid;
alter table public.profiles add constraint profiles_communities_valid check (communities = array['court']);
alter table public.reserve_list drop constraint reserve_list_communities_valid;
alter table public.reserve_list add constraint reserve_list_communities_valid check (communities = array['court']);
alter table public.ranking_adjustments drop constraint ranking_adjustments_community_valid;
alter table public.ranking_adjustments add constraint ranking_adjustments_community_valid check (community = 'court');
alter table public.events drop constraint events_community_valid;
alter table public.events add constraint events_community_valid check (community = 'court');
alter table public.announcements drop constraint announcements_community_valid;
alter table public.announcements add constraint announcements_community_valid check (community = 'court');
alter table public.tournament_reserved_players drop constraint tournament_reserved_players_community_valid;
alter table public.tournament_reserved_players add constraint tournament_reserved_players_community_valid check (community = 'court');
alter table public.shirt_orders drop constraint shirt_orders_community_valid;
alter table public.shirt_orders add constraint shirt_orders_community_valid check (community = 'court');
alter table public.player_balance_entries drop constraint free_racha_credits_community_check;
alter table public.player_balance_entries add constraint free_racha_credits_community_check check (community = 'court');
alter table public.finance_transactions drop constraint finance_transactions_community_check;
alter table public.finance_transactions add constraint finance_transactions_community_check check (community = 'court');
alter table public.finance_reminders drop constraint finance_reminders_community_check;
alter table public.finance_reminders add constraint finance_reminders_community_check check (community = 'court');
alter table public.shirt_finance_transactions drop constraint shirt_finance_transactions_community_check;
alter table public.shirt_finance_transactions add constraint shirt_finance_transactions_community_check check (community = 'court');
alter table public.cups drop constraint cups_community_check;
alter table public.cups add constraint cups_community_check check (community = 'court');

create or replace function public.set_my_communities(p_communities text[])
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Faça login para continuar.';
  end if;

  update public.profiles set communities = array['court'] where id = current_user_id;
  update public.reserve_list set communities = array['court'] where auth_user_id = current_user_id;
end;
$function$;

create or replace function public.add_player_balance(p_profile_id uuid, p_community text, p_amount numeric, p_category text, p_description text, p_notes text, p_cash_effect text)
returns uuid
language plpgsql
set search_path to 'public'
as $function$
declare v_entry_id uuid; v_transaction_type text;
begin
  if not public.is_organizer() then raise exception 'Somente organizadores podem adicionar saldo.'; end if;
  if p_community <> 'court' or p_amount <= 0 then raise exception 'Dados do saldo inválidos.'; end if;
  if p_category not in ('advance_payment','cancellation_credit','challenge','other') then raise exception 'Motivo inválido.'; end if;
  if p_cash_effect not in ('none','income','expense') then raise exception 'Efeito no caixa inválido.'; end if;
  if not exists(select 1 from public.profiles where id=p_profile_id and p_community=any(communities)) then raise exception 'Pessoa fora desta modalidade.'; end if;

  insert into public.player_balance_entries(profile_id,community,entry_type,amount,category,cash_effect,description,notes,created_by)
  values(p_profile_id,p_community,'credit',p_amount,p_category,p_cash_effect,trim(p_description),nullif(trim(p_notes),''),auth.uid())
  returning id into v_entry_id;

  if p_cash_effect <> 'none' then
    v_transaction_type := case when p_cash_effect='income' then 'income' else 'expense' end;
    insert into public.finance_transactions(community,transaction_type,category,description,amount,transaction_date,profile_id,balance_entry_id,notes,created_by)
    values(p_community,v_transaction_type,'balance',trim(p_description),p_amount,current_date,p_profile_id,v_entry_id,nullif(trim(p_notes),''),auth.uid());
  end if;
  return v_entry_id;
end;
$function$;
