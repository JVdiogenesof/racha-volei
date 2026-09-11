import { Star, StarHalf } from "lucide-react";

export function StarRating({ value, size = 16 }: { value: number; size?: number }) {
  const rounded = Math.round(value * 2) / 2;

  return (
    <div className="flex items-center gap-0.5" aria-label={`${rounded.toFixed(1)} de 5 estrelas`}>
      {Array.from({ length: 5 }, (_, i) => {
        const position = i + 1;
        if (rounded >= position) {
          return (
            <Star key={i} width={size} height={size} className="fill-purple-300 text-purple-300" strokeWidth={2} />
          );
        }
        if (rounded >= position - 0.5) {
          return (
            <StarHalf
              key={i}
              width={size}
              height={size}
              className="fill-purple-300 text-purple-300"
              strokeWidth={2}
            />
          );
        }
        return <Star key={i} width={size} height={size} className="text-white/20" strokeWidth={2} />;
      })}
    </div>
  );
}
