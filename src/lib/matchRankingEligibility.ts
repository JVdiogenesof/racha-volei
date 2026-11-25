export type MatchEligibilityEvent = {
  /** Data do racha (AAAA-MM-DD). Necessária para as regras que mudam em dezembro/2026. */
  date?: string;
  num_teams: number;
  is_pre_torneio: boolean;
  is_mini_torneio: boolean;
  /** O organizador escolhe, racha a racha, se ele conta para o ranking. */
  counts_for_ranking?: boolean | null;
};

/**
 * Regulamento novo: a partir do primeiro racha de dezembro/2026 todo racha conta
 * para o Índice e para os demais rankings (inclusive sábado e racha de 3 times),
 * a não ser que o organizador desmarque "Conta para o ranking" ao criá-lo.
 * Rachas anteriores seguem como foram registrados.
 */
export const RANKING_RULES_START_DATE = "2026-12-01";

export function usesNewRankingRules(event: MatchEligibilityEvent): boolean {
  return Boolean(event.date) && (event.date as string).slice(0, 10) >= RANKING_RULES_START_DATE;
}

/** O racha foi marcado para contar no ranking (padrão: conta). */
export function countsTowardRanking(event: MatchEligibilityEvent): boolean {
  return event.counts_for_ranking !== false;
}

/**
 * Antes de dezembro/2026: racha normal (nem pré-torneio, nem mini torneio) com
 * só 3 times joga em rodízio com bem mais partidas que um de 4 times, então os
 * confrontos ficavam fora do ranking (presença continuava contando).
 * Desde dezembro/2026 vale só a escolha "Conta para o ranking" do organizador.
 */
export function countsTowardMatchRanking(event: MatchEligibilityEvent): boolean {
  if (!countsTowardRanking(event)) return false;
  if (usesNewRankingRules(event)) return true;
  if (event.is_pre_torneio || event.is_mini_torneio) return true;
  return event.num_teams !== 3;
}

/** Racha normal (nem pré-torneio, nem mini torneio) marcado para um sábado. */
export function isSaturdayRacha(event: MatchEligibilityEvent): boolean {
  if (event.is_pre_torneio || event.is_mini_torneio || !event.date) return false;
  return new Date(`${event.date}T12:00:00`).getDay() === 6;
}

/**
 * Até novembro/2026, rachas de sábado contavam só presença no Índice VPA.
 * Desde dezembro/2026 o sábado é um racha como os outros.
 */
export function countsTowardIndexResults(event: MatchEligibilityEvent): boolean {
  if (!countsTowardMatchRanking(event)) return false;
  return usesNewRankingRules(event) || !isSaturdayRacha(event);
}
