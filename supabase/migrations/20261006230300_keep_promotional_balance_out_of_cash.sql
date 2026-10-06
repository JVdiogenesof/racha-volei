-- Um saldo promocional é um direito de jogar futuramente, não dinheiro que
-- saiu do caixa no momento em que o crédito foi concedido. A receita daquele
-- racha só deixa de existir quando o saldo for usado.
update public.finance_transactions f
set voided_at = now(), voided_by = f.created_by
from public.player_balance_entries b
where f.balance_entry_id = b.id
  and b.category = 'challenge'
  and f.voided_at is null;

update public.player_balance_entries
set cash_effect = 'none'
where category = 'challenge' and cash_effect = 'expense';
