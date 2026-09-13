const SIZES = {
  sm: "h-8 w-8 text-xs",
  md: "h-11 w-11 text-sm",
  lg: "h-14 w-14 text-base",
};

/** A partir de quantos rachas seguidos o foguinho aparece. */
const STREAK_THRESHOLD = 3;

export function Avatar({
  src,
  name,
  size = "md",
  streak,
}: {
  src?: string | null;
  name: string;
  size?: keyof typeof SIZES;
  /** Sequência de rachas seguidos confirmado -- só exibe o badge a partir de STREAK_THRESHOLD. */
  streak?: number;
}) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join("");

  const showStreak = !!streak && streak >= STREAK_THRESHOLD;

  return (
    <span className="relative inline-flex shrink-0">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={name}
          className={`${SIZES[size]} shrink-0 rounded-full object-cover ring-2 ring-white/15`}
          referrerPolicy="no-referrer"
        />
      ) : (
        <span
          className={`flex ${SIZES[size]} shrink-0 items-center justify-center rounded-full bg-brand-purple/25 font-semibold text-purple-200 ring-2 ring-white/15`}
        >
          {initials || "?"}
        </span>
      )}
      {showStreak && (
        <span
          title={`${streak} rachas seguidos`}
          className="absolute -bottom-1 -right-1 flex items-center gap-0.5 rounded-full border border-brand-navy bg-orange-500 px-1 text-[9px] font-bold leading-none text-white"
        >
          🔥{streak}
        </span>
      )}
    </span>
  );
}
