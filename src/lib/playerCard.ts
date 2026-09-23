import type { PerformanceStats } from "./rankings";

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
    performance: Map<string, PerformanceStats>;
  },
  profileId: string,
  eligibleProfileIds: string[],
): PlayerRankingPositions {
  const eligibleIds = new Set(eligibleProfileIds);
  const playerPerformance = counts.performance.get(profileId);

  const performance = playerPerformance?.matches
    ? 1 +
      [...counts.performance.entries()].filter(([otherId, stats]) => {
        if (!eligibleIds.has(otherId) || !stats.matches) return false;
        return (
          stats.percentage > playerPerformance.percentage ||
          (stats.percentage === playerPerformance.percentage && stats.wins > playerPerformance.wins)
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
