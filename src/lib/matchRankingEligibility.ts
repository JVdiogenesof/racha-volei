export type MatchEligibilityEvent = {
  /** Data do racha (AAAA-MM-DD). Necessária para a regra do sábado no Índice. */
  date?: string;
  num_teams: number;
  is_pre_torneio: boolean;
  is_mini_torneio: boolean;
};

/**
 * Racha normal (nem pré-torneio, nem mini torneio) com só 3 times joga em
 * rodízio onde cada time descansa 1 a cada 3 rodadas -- bem mais partidas no
 * mesmo intervalo de tempo que um racha de 4 times, que descansa 1 a cada 4.
 * Pra não inflar vitórias, derrotas e saldo de quem caiu num racha de 3
 * times, esses confrontos ficam fora do ranking (presença continua contando
 * normalmente, já que não depende de quantas partidas rolaram).
 */
export function countsTowardMatchRanking(event: MatchEligibilityEvent): boolean {
  if (event.is_pre_torneio || event.is_mini_torneio) return true;
  return event.num_teams !== 3;
}

/** Racha normal (nem pré-torneio, nem mini torneio) marcado para um sábado. */
export function isSaturdayRacha(event: MatchEligibilityEvent): boolean {
  if (event.is_pre_torneio || event.is_mini_torneio || !event.date) return false;
  return new Date(`${event.date}T12:00:00`).getDay() === 6;
}

/**
 * Rachas de sábado contam só presença no Índice VPA: os jogos deles não entram
 * em vitórias/derrotas do Índice. Na aba Vitórias do ranking os jogos de
 * sábado continuam valendo (essa aba usa countsTowardMatchRanking).
 */
export function countsTowardIndexResults(event: MatchEligibilityEvent): boolean {
  return countsTowardMatchRanking(event) && !isSaturdayRacha(event);
}
