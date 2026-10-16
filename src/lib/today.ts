const FORTALEZA_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Fortaleza",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * Data de hoje (YYYY-MM-DD) no fuso de Fortaleza -- nunca usar
 * `new Date().toISOString().slice(0, 10)` pra isso: o servidor roda em UTC,
 * então entre 21h e meia-noite no horário local o UTC já virou o dia
 * seguinte, fazendo "hoje" virar amanhã (ex: aniversário de amanhã
 * aparecendo como "hoje", racha de hoje sumindo da lista de próximos).
 */
export function todayStringInFortaleza(date = new Date()): string {
  return FORTALEZA_FORMATTER.format(date);
}

/** Mesma data de `todayStringInFortaleza`, como Date à meia-noite local. */
export function todayDateInFortaleza(date = new Date()): Date {
  return new Date(`${todayStringInFortaleza(date)}T00:00:00`);
}
