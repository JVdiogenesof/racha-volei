-- Lançamento público dentro do app: as policies normais continuam garantindo
-- que cada membro só altera o próprio pedido e que só organizadores veem tudo.
drop policy if exists "shirt_orders_preview_access" on public.shirt_orders;
