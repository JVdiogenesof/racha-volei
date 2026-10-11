import type { SupabaseClient } from "@supabase/supabase-js";
import type { Community } from "./community";
import { getRankingCounts } from "./rankings";
import { currentMonthKey } from "./monthlyReport";

// A temporada classificatória pro torneio oficial de abril/2027 passou a
// contar a partir de setembro/2026 (pra já nascer com 2 meses de amostra) --
// antes disso o Índice VPA acumulava desde o início do app, o que deixava
// quem chegasse depois sem chance real
// de alcançar quem já vinha jogando há mais tempo. Agora cada mês é uma
// amostra própria (mesma fórmula do Índice VPA, só que escopada ao mês) e a
// nota da temporada é a média dos meses jogados -- assim um jogador que
// entrar em 2027 compete de igual pra igual, só precisando manter uma boa
// média nos meses em que jogou.
export const SEASON_START_MONTH = "2026-09";
export const SEASON_MIN_MONTHS = 2;

export type SeasonPlayerScore = {
  profileId: string;
  monthsPlayed: number;
  averageIndex: number;
  totalWins: number;
  totalLosses: number;
  totalAttendance: number;
  eligible: boolean;
};

function monthsBetween(startMonth: string, endMonth: string): string[] {
  const [startYear, startMonthNum] = startMonth.split("-").map(Number);
  const [endYear, endMonthNum] = endMonth.split("-").map(Number);
  const months: string[] = [];
  let year = startYear;
  let month = startMonthNum;
  while (year < endYear || (year === endYear && month <= endMonthNum)) {
    months.push(`${year}-${String(month).padStart(2, "0")}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return months;
}

export async function getSeasonRanking(
  supabase: SupabaseClient,
  community: Community = "court",
  startMonth: string = SEASON_START_MONTH,
): Promise<Map<string, SeasonPlayerScore>> {
  const months = monthsBetween(startMonth, currentMonthKey());
  const monthlyCounts = await Promise.all(months.map((monthKey) => getRankingCounts(supabase, community, monthKey)));

  const scoresByProfile = new Map<string, number[]>();
  const sumsByProfile = new Map<string, { wins: number; losses: number; attendance: number }>();

  for (const counts of monthlyCounts) {
    for (const [profileId, stats] of counts.performance) {
      // Só conta o mês se a pessoa teve presença mínima naquele mês -- um mês
      // em que ela quase não apareceu não deveria entrar na média.
      if (!stats.eligible) continue;
      const scores = scoresByProfile.get(profileId) ?? [];
      scores.push(stats.indexScore);
      scoresByProfile.set(profileId, scores);

      const sums = sumsByProfile.get(profileId) ?? { wins: 0, losses: 0, attendance: 0 };
      sums.wins += stats.wins;
      sums.losses += stats.losses;
      sums.attendance += stats.attendance;
      sumsByProfile.set(profileId, sums);
    }
  }

  const result = new Map<string, SeasonPlayerScore>();
  for (const [profileId, scores] of scoresByProfile) {
    const monthsPlayed = scores.length;
    const averageIndex = Math.round((scores.reduce((sum, score) => sum + score, 0) / monthsPlayed) * 10) / 10;
    const sums = sumsByProfile.get(profileId) ?? { wins: 0, losses: 0, attendance: 0 };
    result.set(profileId, {
      profileId,
      monthsPlayed,
      averageIndex,
      totalWins: sums.wins,
      totalLosses: sums.losses,
      totalAttendance: sums.attendance,
      eligible: monthsPlayed >= SEASON_MIN_MONTHS,
    });
  }
  return result;
}
