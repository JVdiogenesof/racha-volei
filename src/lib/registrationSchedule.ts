import { setterSpotsFor } from "@/lib/rachaSpots";
const FORTALEZA_OFFSET = "-03:00";

export function isRegistrationOpen(registrationOpensAt: string | null, officialListOpen = false, now = Date.now()) {
  if (officialListOpen || !registrationOpensAt) return true;
  return new Date(registrationOpensAt).getTime() <= now;
}

export function registrationOpensAtFromForm(date: string, time: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    throw new Error("Informe a data e o horário de abertura das inscrições.");
  }
  const parsed = new Date(`${date}T${time}:00${FORTALEZA_OFFSET}`);
  if (Number.isNaN(parsed.getTime())) throw new Error("Data de abertura das inscrições inválida.");
  return parsed.toISOString();
}

export function registrationInputParts(registrationOpensAt: string | null) {
  if (!registrationOpensAt) return { date: "", time: "" };
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Fortaleza",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(formatter.formatToParts(new Date(registrationOpensAt)).map((part) => [part.type, part.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

/**
 * Vagas que o público pode ocupar agora. Espelha event_public_capacity no
 * banco: Lote 1 até o Lote 2 abrir, depois todas as vagas.
 */
export function publicCapacityNow(
  event: { max_players: number | null; num_teams: number; team_size: number; first_batch_spots: number | null; second_batch_opens_at: string | null },
  now = Date.now(),
) {
  const total = event.max_players ?? event.num_teams * event.team_size;
  if (event.first_batch_spots != null && event.second_batch_opens_at && new Date(event.second_batch_opens_at).getTime() > now) {
    return Math.min(event.first_batch_spots, total);
  }
  return total;
}

/** Lê os campos de lote do formulário. Tudo vazio = sem lotes. */
export function spotBatchesFromForm(formData: FormData, maxPlayers: number, registrationOpensAt: string | null, eventDate: string) {
  const spotsRaw = String(formData.get("firstBatchSpots") ?? "").trim();
  const date = String(formData.get("secondBatchDate") ?? "").trim();
  const time = String(formData.get("secondBatchTime") ?? "").trim();
  if (!spotsRaw && !date && !time) return { first_batch_spots: null, second_batch_opens_at: null };
  if (!spotsRaw || !date || !time) {
    throw new Error("Para usar lotes, preencha as vagas do Lote 1 e a data e o horário de abertura do Lote 2 (ou deixe os três em branco).");
  }
  const spots = Number(spotsRaw);
  if (!Number.isInteger(spots) || spots < 1 || spots >= maxPlayers) {
    throw new Error(`O Lote 1 precisa ter entre 1 e ${maxPlayers - 1} vagas (o total do racha é ${maxPlayers}).`);
  }
  const opensAt = registrationOpensAtFromForm(date, time);
  if (registrationOpensAt && new Date(opensAt).getTime() <= new Date(registrationOpensAt).getTime()) {
    throw new Error("O Lote 2 precisa abrir depois da abertura das inscrições (Lote 1).");
  }
  if (date > eventDate) throw new Error("O Lote 2 não pode abrir depois do dia do racha.");
  return { first_batch_spots: spots, second_batch_opens_at: opensAt };
}

/** Levantadores que o Lote 1 precisa ter (vagas guardadas para eles). */
export const LOTE1_MIN_SETTERS = 3;

/** Vagas do Lote 1 ainda guardadas para levantadores. Mesma regra do banco. */
export function lote1SetterHold(maxPlayers: number, setters: number) {
  return Math.max(0, lote1SetterLimit(maxPlayers) - setters);
}

/** Levantadores que cabem no Lote 1. */
export function lote1SetterLimit(maxPlayers: number) {
  return Math.min(LOTE1_MIN_SETTERS, setterSpotsFor(maxPlayers));
}

/**
 * Por que esta pessoa está barrada pelo Lote 1 agora (ou null)? Ninguém passa
 * do total do Lote 1. Levantador (com vaga de levantador sobrando) usa
 * qualquer vaga livre do lote; os demais deixam guardadas até 3 vagas para
 * levantadores. Lote cheio com a cota de 3 levantadores já preenchida, para um
 * levantador, é "setters_full". Espelha begin_event_payment_reservation.
 */
export function batchBlockReason(
  event: { max_players: number | null; first_batch_spots: number | null; second_batch_opens_at: string | null },
  confirmed: number,
  setters: number,
  isSetter: boolean,
  now = Date.now(),
): "full" | "setters_full" | null {
  if (event.max_players == null || event.first_batch_spots == null || !event.second_batch_opens_at) return null;
  if (new Date(event.second_batch_opens_at).getTime() <= now) return null;
  const firstSpots = Math.min(event.first_batch_spots, event.max_players);
  const full = confirmed >= firstSpots;
  if (isSetter && setters < setterSpotsFor(event.max_players)) {
    if (!full) return null;
    return setters >= lote1SetterLimit(event.max_players) ? "setters_full" : "full";
  }
  if (full) return "full";
  return confirmed + lote1SetterHold(event.max_players, setters) >= firstSpots ? "full" : null;
}

export function isBlockedByBatch(
  event: { max_players: number | null; first_batch_spots: number | null; second_batch_opens_at: string | null },
  confirmed: number,
  setters: number,
  isSetter: boolean,
  now = Date.now(),
) {
  return batchBlockReason(event, confirmed, setters, isSetter, now) !== null;
}

/** Em que fase de lotes o racha está agora. */
export function batchPhase(
  secondBatchOpensAt: string,
  firstSpots: number,
  confirmed: number,
  now = Date.now(),
  registrationOpensAt: string | null = null,
  setterHold = 0,
) {
  if (new Date(secondBatchOpensAt).getTime() <= now) return "second_open" as const;
  if (registrationOpensAt && new Date(registrationOpensAt).getTime() > now) return "not_open" as const;
  // "Esgotado" para quem não é levantador: as vagas guardadas para
  // levantadores no Lote 1 também não estão disponíveis para os demais.
  return confirmed + setterHold >= firstSpots ? ("first_full" as const) : ("first_open" as const);
}

/** "sexta-feira, 13/11 às 12:00" (horário de Fortaleza). */
export function formatBatchOpening(iso: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Fortaleza",
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(iso))
      .map((part) => [part.type, part.value]),
  );
  return `${parts.weekday}, ${parts.day}/${parts.month} às ${parts.hour}:${parts.minute}`;
}

/**
 * Lote 1 esgotado e Lote 2 ainda fechado: devolve quando o Lote 2 abre, para
 * os botões explicarem isso em vez de "lista cheia". Senão, null.
 */
export function waitingForSecondBatch(
  event: { max_players: number | null; first_batch_spots: number | null; second_batch_opens_at: string | null },
  confirmed: number,
  setters = 0,
  now = Date.now(),
) {
  if (event.max_players == null || event.first_batch_spots == null || !event.second_batch_opens_at) return null;
  const phase = batchPhase(
    event.second_batch_opens_at,
    Math.min(event.first_batch_spots, event.max_players),
    confirmed,
    now,
    null,
    lote1SetterHold(event.max_players, setters),
  );
  return phase === "first_full" ? formatBatchOpening(event.second_batch_opens_at) : null;
}
