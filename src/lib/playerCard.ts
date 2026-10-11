import type { SeasonPlayerScore } from "./seasonRanking";

export type PlayerRankingPositions = {
  attendance: number | null;
  mvp: number | null;
  wins: number | null;
  performance: number | null;
};

function metricPosition(counts: Map<string, number>, profileId: string, eligibleIds: Set<string>) {
  const value = Math.max(0, counts.get(profileId) ?? 0);
  if (!value) return null;

  return (
    1 +
    [...counts.entries()].filter(
      ([otherId, otherValue]) => eligibleIds.has(otherId) && Math.max(0, otherValue) > value,
    ).length
  );
}

export function getPlayerRankingPositions(
  counts: {
    attendance: Map<string, number>;
    mvp: Map<string, number>;
    wins: Map<string, number>;
  },
  season: Map<string, SeasonPlayerScore>,
  profileId: string,
  eligibleProfileIds: string[],
): PlayerRankingPositions {
  const eligibleIds = new Set(eligibleProfileIds);
  const playerSeason = season.get(profileId);

  // Mesma base do ranking da temporada (média dos meses jogados), pra posição
  // mostrada no cartão do jogador bater com a da tela de Ranking.
  const performance = playerSeason?.eligible
    ? 1 +
      [...season.entries()].filter(([otherId, stats]) => {
        if (!eligibleIds.has(otherId) || !stats.eligible) return false;
        return (
          stats.averageIndex > playerSeason.averageIndex ||
          (stats.averageIndex === playerSeason.averageIndex && stats.totalWins > playerSeason.totalWins)
        );
      }).length
    : null;

  return {
    attendance: metricPosition(counts.attendance, profileId, eligibleIds),
    mvp: metricPosition(counts.mvp, profileId, eligibleIds),
    wins: metricPosition(counts.wins, profileId, eligibleIds),
    performance,
  };
}
