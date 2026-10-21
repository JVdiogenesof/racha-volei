-- Confronto normal (sem tabela de torneio) so registrava quem venceu, sem
-- placar nenhum -- por isso o saldo de pontos do Indice VPA nunca contava pra
-- racha fora de pre-torneio/mini torneio. Com os rachas de sabado passando a
-- ser normais, o saldo precisa funcionar neles tambem.
--
-- winner_score/loser_score guardam o placar do confronto normal direto aqui
-- (sem passar por tournament_matches, que e so pra tabela estruturada de
-- torneio). Ficam nulos pra confronto antigo, ja registrado sem placar --
-- esse historico continua contando vitoria/derrota, so nao ganha saldo
-- retroativo (nao tem como recuperar um placar que nunca foi lancado).
alter table match_wins add column if not exists winner_score integer;
alter table match_wins add column if not exists loser_score integer;
alter table match_wins add constraint match_wins_scores_check
  check (
    (winner_score is null and loser_score is null)
    or (winner_score is not null and loser_score is not null and winner_score > loser_score and winner_score >= 0 and loser_score >= 0)
  );
