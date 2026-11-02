/**
 * Vagas do torneio oficial que vêm do ranking.
 *
 * Quem já garantiu vaga num pré-torneio continua aparecendo no ranking, mas não
 * ocupa uma das vagas do ranking: a zona desce até completar `slots` pessoas
 * sem vaga garantida. Assim, se 10 pessoas já passaram pelos pré-torneios e
 * estão no alto do ranking, as vagas do ranking descem 10 posições.
 */
export function getTournamentZone(rankedProfileIds: readonly string[], guaranteedIds: ReadonlySet<string>, slots: number) {
  const rankingQualifiedIds = new Set<string>();
  let cutoffPosition: number | null = null;

  for (let index = 0; index < rankedProfileIds.length; index += 1) {
    const profileId = rankedProfileIds[index];
    if (guaranteedIds.has(profileId)) continue;
    rankingQualifiedIds.add(profileId);
    if (rankingQualifiedIds.size === slots) {
      cutoffPosition = index + 1;
      break;
    }
  }

  return {
    /** Quem entra pelo ranking (sem contar os garantidos). */
    rankingQualifiedIds,
    /** Posição (1 = primeiro) da última vaga do ranking; null se ainda há vagas sobrando. */
    cutoffPosition,
    /** Quantas posições do ranking ficam dentro da zona. */
    zoneEnd: cutoffPosition ?? rankedProfileIds.length,
  };
}
