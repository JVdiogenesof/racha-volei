import type { Badge } from "@/lib/badges";
import { AchievementEmblem, badgeGlyph, badgeTone } from "./AchievementEmblem";

const SIZE = { sm: 36, md: 48, lg: 64 };

/** Medalha desenhada (disco serrilhado com fita). `locked` deixa apagada (ainda não ganhou). */
export function BadgeIcon({ badge, size = "md", locked = false }: { badge: Pick<Badge, "emoji" | "color" | "title">; size?: keyof typeof SIZE; locked?: boolean }) {
  return (
    <span title={badge.title} className={`inline-flex shrink-0 drop-shadow-[0_4px_8px_rgba(0,0,0,.35)] ${locked ? "opacity-60" : ""}`}>
      <AchievementEmblem glyph={badgeGlyph(badge.emoji)} tone={locked ? "locked" : badgeTone(badge.color)} shape="medal" size={SIZE[size]} />
      <span className="sr-only">{badge.title}</span>
    </span>
  );
}
