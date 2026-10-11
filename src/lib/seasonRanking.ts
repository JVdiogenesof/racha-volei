import type { SupabaseClient } from "@supabase/supabase-js";
import type { Community } from "./community";
import { getRankingCounts } from "./rankings";
import { currentMonthKey, monthRange } from "./monthlyReport";

// A temporada classificatória pro torneio oficial de abril/2027 passou a
// contar a partir de setembro/2026. Em vez de acumular desde o início do
// app, cada período agora é uma amostra própria (mesma fórmula do Índice
// VPA, só escopada ao período) e a nota da temporada é a média das amostras
// jogadas -- assim um jogador que entrar em 2027 compete de igual pra
// igual, só precisando manter uma boa média nos períodos em que jogou.
//
// Setembro e outubro de 2026 são tratados como um único "período de
// lançamento": a funcionalidade entrou em vigor no meio do caminho, então
// em vez de calcular um índice pra cada mês e tirar a média dos dois (o que
// penalizaria quem teve um mês bom e um mediano só por causa de quando a
// mudança nasceu), os dois meses são somados e viram UM índice só -- que já
// conta como os 2 meses mínimos da temporada por cobrir 2 meses de
// calendário. A partir de novembro/2026, cada mês novo volta a ser uma
// amostra independente, e a temporada cresce mês a mês normalmente.
export const SEASON_START_MONTH = "2026-09";
export const SEASON_MIN_MONTHS = 2;

const LAUNCH_PERIOD_START_MONTH = "2026-09";
const LAUNCH_PERIOD_END_MONTH = "2026-10";
const LAUNCH_PERIOD_MONTHS_COVERED = 2;

export type SeasonPlayerScore = {
  profileId: string;
  monthsPlayed: number;
  averageIndex: number;
  totalWins: number;
  totalLosses: number;
  totalAttendance: number;
  eligible: boolean;
};

type SeasonPeriod = {
  monthKey?: string;
  range?: { start: string; nextStart: string };
  monthsCovered: number;
};

function nextMonthKey(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
}

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

function buildSeasonPeriods(currentMonth: string): SeasonPeriod[] {
  const launchRange = {
    start: monthRange(LAUNCH_PERIOD_START_MONTH).start,
    nextStart: monthRange(LAUNCH_PERIOD_END_MONTH).nextStart,
  };
  const periods: SeasonPeriod[] = [{ range: launchRange, monthsCovered: LAUNCH_PERIOD_MONTHS_COVERED }];

  // Meses depois do período de lançamento, um a um -- fica vazio enquanto
  // ainda estivermos dentro de set/out.
  const extraMonths = monthsBetween(nextMonthKey(LAUNCH_PERIOD_END_MONTH), currentMonth);
  for (const monthKey of extraMonths) {
    periods.push({ monthKey, monthsCovered: 1 });
  }
  return periods;
}

export async function getSeasonRanking(
  supabase: SupabaseClient,
  community: Community = "court",
): Promise<Map<string, SeasonPlayerScore>> {
  const periods = buildSeasonPeriods(currentMonthKey());
  const periodCounts = await Promise.all(
    periods.map((period) => getRankingCounts(supabase, community, period.monthKey ?? period.range)),
  );

  const scoresByProfile = new Map<string, number[]>();
  const monthsCoveredByProfile = new Map<string, number>();
  const sumsByProfile = new Map<string, { wins: number; losses: number; attendance: number }>();

  periodCounts.forEach((counts, index) => {
    const monthsCovered = periods[index].monthsCovered;
    for (const [profileId, stats] of counts.performance) {
      // Só conta o período se a pessoa teve presença mínima nele -- um
      // período em que ela quase não apareceu não deveria entrar na média.
      if (!stats.eligible) continue;
      const scores = scoresByProfile.get(profileId) ?? [];
      scores.push(stats.indexScore);
      scoresByProfile.set(profileId, scores);

      monthsCoveredByProfile.set(profileId, (monthsCoveredByProfile.get(profileId) ?? 0) + monthsCovered);

      const sums = sumsByProfile.get(profileId) ?? { wins: 0, losses: 0, attendance: 0 };
      sums.wins += stats.wins;
      sums.losses += stats.losses;
      sums.attendance += stats.attendance;
      sumsByProfile.set(profileId, sums);
    }
  });

  const result = new Map<string, SeasonPlayerScore>();
  for (const [profileId, scores] of scoresByProfile) {
    const monthsPlayed = monthsCoveredByProfile.get(profileId) ?? scores.length;
    const averageIndex = Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 10) / 10;
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
