const SIZES = {
  sm: "h-8 w-8 text-xs",
  md: "h-11 w-11 text-sm",
  lg: "h-14 w-14 text-base",
};

/** A partir de quantos rachas seguidos o anel de fogo aparece. */
const STREAK_THRESHOLD = 3;

export function Avatar({
  src,
  name,
  size = "md",
  streak,
  ring,
}: {
  src?: string | null;
  name: string;
  size?: keyof typeof SIZES;
  /** Sequência de rachas seguidos -- a partir de STREAK_THRESHOLD a foto ganha um anel de fogo animado. */
  streak?: number;
  /** Cor do anel ao redor do avatar (classe Tailwind). Padrão: branco translúcido. */
  ring?: string;
}) {
  const ringClass = ring ?? "ring-white/15";
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join("");

  const showStreak = !!streak && streak >= STREAK_THRESHOLD;

  const photo = src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name}
      className={`avatar-photo ${SIZES[size]} shrink-0 rounded-full object-cover ring-2 ${showStreak ? "ring-transparent" : ringClass}`}
      referrerPolicy="no-referrer"
    />
  ) : (
    <span
      className={`avatar-photo flex ${SIZES[size]} shrink-0 items-center justify-center rounded-full bg-brand-purple/25 font-semibold text-purple-200 ring-2 ${showStreak ? "ring-transparent" : ringClass}`}
    >
      {initials || "?"}
    </span>
  );

  if (!showStreak) return <span className="relative inline-flex shrink-0">{photo}</span>;

  // Anel de fogo: chamas nascem na borda e sobem, com ritmos diferentes pra não piscar tudo junto.
  return (
    <span className="fire-ring shrink-0" title={`${streak} rachas seguidos`} aria-label={`${name}, ${streak} rachas seguidos`}>
      <span className="fire-ring__glow" aria-hidden />
      {FLAMES.map((flame) => (
        <span key={flame.key} className="fire-ring__tongue" style={flame.style} aria-hidden />
      ))}
      <span className="fire-ring__band" aria-hidden />
      {photo}
    </span>
  );
}

/** Ângulo 0 = topo da foto. Calculado uma vez só (é igual pra todo avatar). */
const FLAMES = [-125, -100, -75, -50, -25, 0, 25, 50, 75, 100, 125].map((deg, index) => {
  const rad = (deg * Math.PI) / 180;
  const r = 0.4; // um pouco pra dentro da borda: a base da chama fica escondida atrás da foto
  const height = 24 + 30 * Math.max(0, Math.cos(rad / 1.25)); // mais alta no topo
  return {
    key: deg,
    style: {
      left: `${50 + 100 * r * Math.sin(rad)}%`,
      top: `${50 - 100 * r * Math.cos(rad)}%`,
      "--h": `${height.toFixed(1)}%`,
      "--w": `${(22 + 8 * Math.cos(rad / 1.25)).toFixed(1)}%`,
      "--d": `${(0.55 + ((index * 37) % 40) / 100).toFixed(2)}s`,
      "--delay": `${(-((index * 53) % 90) / 100).toFixed(2)}s`,
    } as React.CSSProperties,
  };
});
