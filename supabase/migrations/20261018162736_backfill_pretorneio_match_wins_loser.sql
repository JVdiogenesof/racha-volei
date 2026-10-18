-- recordTournamentMatchScore só gravava loser_team_id/winning_profile_ids/
-- losing_profile_ids em match_wins quando o racha era mini torneio -- pré
-- torneio sempre deixou esses campos nulos. Sem loser_team_id,
-- rankings.ts/seasonRanking.ts (Índice VPA) descartam o confronto inteiro
-- ("continue" por falta de perdedor), então ninguém que só jogou um
-- pré-torneio entrava no índice e os aproveitamentos de quem jogou pré-torneio
-- e racha normal ficavam incompletos. Esse backfill recalcula os campos que
-- faltaram a partir do que já está gravado em tournament_matches/team_members
-- (dados existentes, nada inventado) para todo match_wins de pré-torneio.
update match_wins mw
set
  loser_team_id = case when mw.team_id = tm.team_a_id then tm.team_b_id else tm.team_a_id end,
  winning_profile_ids = (
    select coalesce(array_agg(tmem.profile_id), '{}')
    from team_members tmem
    where tmem.team_id = mw.team_id
  ),
  losing_profile_ids = (
    select coalesce(array_agg(tmem.profile_id), '{}')
    from team_members tmem
    where tmem.team_id = case when mw.team_id = tm.team_a_id then tm.team_b_id else tm.team_a_id end
  )
from tournament_matches tm
join events e on e.id = tm.event_id
where mw.match_id = tm.id
  and e.is_pre_torneio = true
  and mw.loser_team_id is null;
