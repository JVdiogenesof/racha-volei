import type { MonthlyReport, MonthlyReportPlayer } from "@/lib/monthlyReport";

export type MonthlySelectionPlayer = MonthlyReportPlayer & {
  monthlyIndex: number;
  selectionScore: number;
  role: "setter" | "player";
};

export type MonthlySelection = {
  setter: MonthlySelectionPlayer | null;
  players: MonthlySelectionPlayer[];
  complete: boolean;
};

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}

/**
 * Forma a seleção mensal sem gravar uma escolha permanente no banco.
 * O Índice VPA mensal vale 60%, vitórias 20%, presença 10% e destaques 10%.
 * Dentro do Índice VPA, mantemos a regra pública: 70% aproveitamento e 30% presença.
 */
export function getMonthlySelection(report: MonthlyReport): MonthlySelection {
  if (!report.unlocked || !report.players.length) {
    return { setter: null, players: [], complete: false };
  }

  const maxWins = Math.max(1, ...report.players.map((player) => player.wins));
  const maxMvp = Math.max(1, ...report.players.map((player) => player.mvp));
  const eventCount = Math.max(1, report.finishedEvents.length);

  const scored = report.players
    .filter((player) => player.attendance > 0)
    .map((player) => {
      const attendancePercentage = Math.min(100, (player.attendance / eventCount) * 100);
      const performancePercentage = player.percentage ?? 0;
      const monthlyIndex = performancePercentage * 0.7 + attendancePercentage * 0.3;
      const winsPercentage = (player.wins / maxWins) * 100;
      const mvpPercentage = (player.mvp / maxMvp) * 100;
      const selectionScore = monthlyIndex * 0.6 + winsPercentage * 0.2 + attendancePercentage * 0.1 + mvpPercentage * 0.1;
      return {
        ...player,
        monthlyIndex: roundOne(monthlyIndex),
        selectionScore: roundOne(selectionScore),
        role: "player" as const,
      };
    })
    .sort((a, b) =>
      b.selectionScore - a.selectionScore ||
      b.monthlyIndex - a.monthlyIndex ||
      b.wins - a.wins ||
      b.attendance - a.attendance ||
      a.fullName.localeCompare(b.fullName, "pt-BR"),
    );

  const bestSetter = scored.find((player) => player.setterAppearances > 0) ?? null;
  const setter = bestSetter ? { ...bestSetter, role: "setter" as const } : null;
  const players = scored.filter((player) => player.setterAppearances === 0).slice(0, 5);

  return { setter, players, complete: Boolean(setter) && players.length === 5 };
}
