import { BADGE_TILE, type Badge } from "@/lib/badges";

const SIZE = {
  sm: "h-9 w-9 text-lg rounded-xl",
  md: "h-12 w-12 text-2xl rounded-2xl",
  lg: "h-16 w-16 text-4xl rounded-2xl",
};

/** Azulejo da medalha: emoji sobre fundo colorido. `locked` deixa cinza (ainda não ganhou). */
export function BadgeIcon({ badge, size = "md", locked = false }: { badge: Pick<Badge, "emoji" | "color" | "title">; size?: keyof typeof SIZE; locked?: boolean }) {
  return (
    <span
      title={badge.title}
      className={`inline-flex shrink-0 items-center justify-center border shadow-md ${SIZE[size]} ${
        locked ? "border-white/10 bg-white/5 opacity-50 grayscale" : BADGE_TILE[badge.color]
      }`}
    >
      <span aria-hidden>{badge.emoji}</span>
      <span className="sr-only">{badge.title}</span>
    </span>
  );
}
