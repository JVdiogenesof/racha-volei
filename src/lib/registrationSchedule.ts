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
