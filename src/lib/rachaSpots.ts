/** Vagas de levantador: 1 a cada 6 jogadores, para baixo (18 e 20 = 3; 24 = 4). Mesma regra do banco. */
export function setterSpotsFor(capacity: number) {
  return Math.max(1, Math.floor(capacity / 6));
}

/**
 * A pessoa ainda tem vaga para ela? Espelha begin_event_payment_reservation:
 * as vagas de levantador ficam protegidas, e novato além da cota de novatos
 * ocupa uma vaga comum.
 */
export function isListFullFor({
  capacity,
  newcomerReserved,
  confirmed,
  setters,
  newcomers,
  isSetter,
  isGuest,
}: {
  capacity: number;
  newcomerReserved: number;
  confirmed: number;
  setters: number;
  newcomers: number;
  isSetter: boolean;
  isGuest: boolean;
}) {
  if (confirmed >= capacity) return true;
  if (isSetter && setters < setterSpotsFor(capacity)) return false;
  if (isGuest && !isSetter && newcomerReserved > 0) return newcomers >= newcomerReserved;
  const commonTaken = confirmed - setters - Math.min(newcomers, newcomerReserved);
  return commonTaken >= capacity - setterSpotsFor(capacity) - newcomerReserved;
}
