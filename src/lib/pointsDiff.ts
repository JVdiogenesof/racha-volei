/** Saldo com sinal explícito: +12, −5 ou 0. */
export function formatPointsDiff(value: number) {
  if (value > 0) return `+${value}`;
  if (value < 0) return `−${Math.abs(value)}`;
  return "0";
}
