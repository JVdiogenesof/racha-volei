import { levelLabel } from "@/lib/scoring";
import { StarRating } from "@/components/StarRating";

export function RachaLevelBadge({ level }: { level: number }) {
  return (
    <div className="flex items-center gap-2">
      <StarRating value={level} />
      <span className="text-sm text-white/70">
        {level.toFixed(1)} · {levelLabel(level)}
      </span>
    </div>
  );
}
