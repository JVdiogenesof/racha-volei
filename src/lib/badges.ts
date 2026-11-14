/** Medalhas e troféus de eventos: tipos e cores (o catálogo mora na tabela `badges`). */
export type BadgeKind = "tournament" | "event" | "special";
export type BadgeColor = "amber" | "purple" | "sky" | "emerald" | "rose" | "fuchsia" | "orange" | "slate";

export type Badge = {
  id: string;
  title: string;
  description: string;
  emoji: string;
  kind: BadgeKind;
  color: BadgeColor;
  sort_order: number;
};

/** Medalha que a pessoa ganhou: quando e por quê. */
export type EarnedBadge = {
  badge_id: string;
  note: string | null;
  awarded_at: string;
};

export const BADGE_KIND_LABEL: Record<BadgeKind, string> = {
  tournament: "Torneio",
  event: "Evento",
  special: "Especial",
};

export const BADGE_COLORS: readonly BadgeColor[] = ["amber", "purple", "sky", "emerald", "rose", "fuchsia", "orange", "slate"];

/** Classes completas (o Tailwind precisa ver o texto inteiro, sem montar string). */
export const BADGE_TILE: Record<BadgeColor, string> = {
  amber: "border-amber-300/50 bg-gradient-to-br from-amber-300/30 to-amber-600/20 shadow-amber-400/30",
  purple: "border-purple-300/50 bg-gradient-to-br from-purple-400/30 to-purple-700/20 shadow-purple-400/30",
  sky: "border-sky-300/50 bg-gradient-to-br from-sky-300/30 to-sky-600/20 shadow-sky-400/30",
  emerald: "border-emerald-300/50 bg-gradient-to-br from-emerald-300/30 to-emerald-600/20 shadow-emerald-400/30",
  rose: "border-rose-300/50 bg-gradient-to-br from-rose-300/30 to-rose-600/20 shadow-rose-400/30",
  fuchsia: "border-fuchsia-300/50 bg-gradient-to-br from-fuchsia-300/30 to-fuchsia-600/20 shadow-fuchsia-400/30",
  orange: "border-orange-300/50 bg-gradient-to-br from-orange-300/30 to-orange-600/20 shadow-orange-400/30",
  slate: "border-slate-200/50 bg-gradient-to-br from-slate-200/30 to-slate-500/20 shadow-slate-300/30",
};

export const BADGE_SWATCH: Record<BadgeColor, string> = {
  amber: "bg-amber-400", purple: "bg-purple-400", sky: "bg-sky-400", emerald: "bg-emerald-400",
  rose: "bg-rose-400", fuchsia: "bg-fuchsia-400", orange: "bg-orange-400", slate: "bg-slate-300",
};

export function formatAwardedDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Fortaleza" });
}
