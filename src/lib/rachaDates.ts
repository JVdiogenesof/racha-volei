/** Partes da data de um racha ("YYYY-MM-DD") para mostrar o dia de forma bem clara. */
export function rachaDayParts(date: string) {
  const value = new Date(`${date}T00:00:00`);
  const format = (options: Intl.DateTimeFormatOptions) => value.toLocaleDateString("pt-BR", options).replace(".", "");
  return {
    weekdayLong: format({ weekday: "long" }),
    weekdayShort: format({ weekday: "short" }),
    day: format({ day: "2-digit" }),
    monthShort: format({ month: "short" }),
    dayMonthLong: format({ day: "numeric", month: "long" }),
  };
}

/** "sexta-feira, 06/11 às 20:00", no horário de Fortaleza. */
export function formatRegistrationOpening(opensAt: string) {
  const formatter = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Fortaleza",
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(formatter.formatToParts(new Date(opensAt)).map((part) => [part.type, part.value]));
  return `${parts.weekday}, ${parts.day}/${parts.month} às ${parts.hour}:${parts.minute}`;
}
