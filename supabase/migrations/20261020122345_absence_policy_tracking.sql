-- Regulamento de Permanência: além de remover quem passa de 6 rachas seguidos
-- sem participar, os organizadores precisam ver no painel QUEM saiu por falta
-- (pra reverter caso tenha sido injusto) e poder reverter de verdade.
--
-- absence_removed_at: preenchido quando a remoção veio da regra automática.
--   Fica nulo em remoção manual, o que separa os dois casos na tela do admin.
-- absence_counts_from: quando um organizador restaura alguém, a contagem de
--   faltas recomeça desta data. Sem isso, a pessoa restaurada seria removida
--   de novo no racha seguinte, porque o streak dela continua em 6+.
alter table profiles add column if not exists absence_removed_at timestamptz;
alter table profiles add column if not exists absence_counts_from timestamptz;
