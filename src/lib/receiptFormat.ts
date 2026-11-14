const TZ = "America/Fortaleza";

export const SOURCE_LABEL: Record<string, string> = {
  pix: "Pix (Mercado Pago)",
  balance: "Saldo do app",
  cash: "Pago à organização",
  exempt: "Isento",
};

export function money(value: number | null | undefined) {
  if (value == null) return "—";
  return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function dateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: TZ });
}

export function eventDayLabel(date: string) {
  return new Date(`${date}T12:00:00-03:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit", timeZone: TZ });
}
