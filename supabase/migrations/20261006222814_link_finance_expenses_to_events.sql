-- Despesas antigas de aluguel registradas na mesma data de um único racha
-- passam a compor automaticamente a sobra desse racha.
update public.finance_transactions f
set event_id = e.id
from public.events e
where f.event_id is null
  and f.category = 'court_rental'
  and f.community = e.community
  and f.transaction_date = e.date
  and (
    select count(*) from public.events matching
    where matching.community = f.community and matching.date = f.transaction_date
  ) = 1;
