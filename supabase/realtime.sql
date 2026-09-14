-- Habilita o Supabase Realtime pra tabela "attendance". Precisa disso pro
-- contador de confirmados (ConfirmedCounter) atualizar sozinho na tela de
-- todo mundo quando alguém confirma presença, sem precisar dar refresh na
-- página. Não é gerenciado pelo Drizzle (é config de replicação do Postgres,
-- não faz parte do schema de tabelas) — se o banco for recriado do zero,
-- rode este arquivo de novo no SQL Editor do Supabase.

alter publication supabase_realtime add table attendance;
