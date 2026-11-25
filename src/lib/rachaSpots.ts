/** Vagas de levantador: 1 a cada 6 jogadores, para baixo (18 e 20 = 3; 24 = 4). Mesma regra do banco. */
export function setterSpotsFor(capacity: number) {
  return Math.max(1, Math.floor(capacity / 6));
}

/** Quantas vagas de levantador novato valem: 0 a 2, nunca mais que as vagas de novato ou de levantador. */
export function newcomerSetterSpotsFor(capacity: number, newcomerReserved: number, newcomerSetterSpots: number) {
  return Math.max(0, Math.min(newcomerSetterSpots, newcomerReserved, setterSpotsFor(capacity)));
}

/**
 * A pessoa ainda tem vaga para ela? Espelha event_slot_fits (banco):
 * - levantador novato (K) conta dentro das vagas de novato e ocupa uma vaga de levantador;
 * - levantador do grupo fica com S - K vagas;
 * - novato comum fica com N - K; jogador do grupo com capacidade - S - N + K.
 * `setters` e `newcomers` são os totais (inclui os levantadores novatos).
 */
export function isListFullFor({
  capacity,
  newcomerReserved,
  newcomerSetterSpots = 0,
  confirmed,
  setters,
  newcomers,
  newcomerSetters = 0,
  isSetter,
  isGuest,
}: {
  capacity: number;
  newcomerReserved: number;
  newcomerSetterSpots?: number;
  confirmed: number;
  setters: number;
  newcomers: number;
  newcomerSetters?: number;
  isSetter: boolean;
  isGuest: boolean;
}) {
  if (confirmed >= capacity) return true;
  const S = setterSpotsFor(capacity);
  const N = newcomerReserved;
  const k = newcomerSetterSpotsFor(capacity, N, newcomerSetterSpots);
  const newcomerSetterCount = Math.min(newcomerSetters, setters, newcomers);
  const memberSetters = setters - newcomerSetterCount;
  const newcomerRegulars = newcomers - newcomerSetterCount;
  const regulars = Math.max(0, confirmed - setters - newcomerRegulars);
  const wantsNewcomer = isGuest && N > 0;

  if (isSetter) {
    const setterFits = wantsNewcomer
      ? newcomerSetterCount < k
      : memberSetters + Math.max(0, newcomerSetterCount - k) < S - k;
    if (setterFits) return false;
  }
  if (wantsNewcomer) return newcomerRegulars >= N - k;
  return regulars + Math.max(0, newcomerRegulars + newcomerSetterCount - N) >= capacity - S - N + k;
}
