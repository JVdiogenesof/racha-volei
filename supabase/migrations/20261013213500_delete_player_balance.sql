-- Permite ao organizador excluir (zerar) o saldo disponivel de uma pessoa de uma vez.
-- Aditivo e compativel com a versao publicada: nao altera tabelas, apenas adiciona uma funcao.
-- O historico e preservado (lancamentos ficam marcados como estornados).
create or replace function public.delete_player_balance(p_profile_id uuid, p_community text)
returns numeric language plpgsql security invoker set search_path = public as $$
declare
  v_net numeric;
  v_removed numeric := 0;
  v_entry public.player_balance_entries%rowtype;
begin
  if not public.is_organizer() then raise exception 'Somente organizadores podem excluir saldo.'; end if;

  select coalesce(sum(case when entry_type='credit' then amount else -amount end),0) into v_net
    from public.player_balance_entries
    where profile_id=p_profile_id and community=p_community and reversed_at is null;

  if v_net <= 0.009 then raise exception 'Esta pessoa não tem saldo disponível.'; end if;

  for v_entry in
    select * from public.player_balance_entries
    where profile_id=p_profile_id and community=p_community and entry_type='credit' and reversed_at is null
    order by created_at desc
    for update
  loop
    exit when v_net <= 0.009;
    if v_net < v_entry.amount then
      raise exception 'Parte do saldo já foi usada em um racha. Desmarque primeiro o pagamento feito com saldo.';
    end if;
    update public.player_balance_entries set reversed_at=now(), reversed_by=auth.uid() where id=v_entry.id;
    update public.finance_transactions set voided_at=now(), voided_by=auth.uid()
      where balance_entry_id=v_entry.id and voided_at is null;
    v_net := v_net - v_entry.amount;
    v_removed := v_removed + v_entry.amount;
  end loop;

  return v_removed;
end;
$$;
revoke all on function public.delete_player_balance(uuid,text) from public, anon;
grant execute on function public.delete_player_balance(uuid,text) to authenticated;
