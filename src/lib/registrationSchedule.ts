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
