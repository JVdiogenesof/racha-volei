-- Copa VPA: um Pix que chega quando a presença já está paga (Pix anterior ou
-- "Marcar pago" da organização) não sobrescreve a confirmação: vira devolução.
--
-- Cenário que isto fecha: a pessoa gera o Pix (código vale 30 min), a
-- organização marca "pago" à mão nesse meio tempo, e a pessoa paga o código
-- aberto. Antes, o pagamento novo trocava a confirmação manual por "pix" e o
-- valor entrava duas vezes sem aviso. Agora ele cai em "Devoluções pendentes".
--
-- Só substitui a função (mesma assinatura e permissões); nenhuma tabela muda.

create or replace function public.complete_cup_pix_payment(
  p_intent_id uuid,
  p_provider_order_id text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_intent public.cup_payment_intents%rowtype;
  v_cup public.cups%rowtype;
  v_ok boolean;
begin
  select * into v_intent from public.cup_payment_intents where id = p_intent_id for update;
  if not found then raise exception 'Cobrança não encontrada.'; end if;
  if v_intent.provider_order_id is distinct from trim(p_provider_order_id) then
    raise exception 'A cobrança não corresponde ao pedido.';
  end if;
  if v_intent.status = 'paid' then return 'paid'; end if;
  if v_intent.status in ('refund_needed', 'refunded') then return 'refund_needed'; end if;

  select * into v_cup from public.cups where id = v_intent.cup_id for update;

  -- Vale se a cobrança nasceu antes do prazo, a pessoa segue classificada,
  -- não desistiu nesse meio tempo e ainda não tem a presença paga.
  v_ok := v_cup.confirm_deadline is not null
    and v_intent.created_at < v_cup.confirm_deadline
    and exists (select 1 from public.cup_qualified_players where cup_id = v_intent.cup_id and profile_id = v_intent.profile_id)
    and not exists (
      select 1 from public.cup_confirmations
      where cup_id = v_intent.cup_id and profile_id = v_intent.profile_id and status = 'declined'
        and decided_at > v_intent.created_at
    )
    and not exists (
      select 1 from public.cup_confirmations
      where cup_id = v_intent.cup_id and profile_id = v_intent.profile_id and status = 'confirmed'
        and payment_source in ('pix', 'manual')
    );

  if not v_ok then
    update public.cup_payment_intents
    set status = 'refund_needed', paid_at = now(), updated_at = now()
    where id = v_intent.id;
    return 'refund_needed';
  end if;

  insert into public.cup_confirmations (cup_id, profile_id, status, payment_source, amount)
  values (v_intent.cup_id, v_intent.profile_id, 'confirmed', 'pix', v_intent.amount)
  on conflict (cup_id, profile_id) do update
    set status = 'confirmed', payment_source = 'pix', amount = excluded.amount, decided_at = now();

  update public.cup_payment_intents
  set status = 'paid', paid_at = now(), updated_at = now()
  where id = v_intent.id;
  return 'paid';
end;
$$;

revoke all on function public.complete_cup_pix_payment(uuid, text) from public, anon, authenticated;
grant execute on function public.complete_cup_pix_payment(uuid, text) to service_role;
