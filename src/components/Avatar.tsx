import { AvatarFrameArt } from "./AvatarFrameArt";
import { isAvatarFrameId } from "@/lib/avatarFrames";

const SIZES = {
  sm: "h-8 w-8 text-xs",
  /** Cabeçalho: a menor foto em que a moldura inteira cabe na altura da barra. */
  hd: "h-9 w-9 text-xs",
  md: "h-11 w-11 text-sm",
  lg: "h-14 w-14 text-base",
  xl: "h-20 w-20 text-xl",
  /** Destaque da live do sorteio da Copa. */
  "2xl": "h-32 w-32 text-4xl",
};

export function Avatar({
  src,
  name,
  size = "md",
  ring,
  frame,
  still,
}: {
  src?: string | null;
  name: string;
  size?: keyof typeof SIZES;
  /** Cor do anel ao redor do avatar (classe Tailwind). Padrão: branco translúcido. */
  ring?: string;
  /** Moldura escolhida pela pessoa (id de lib/avatarFrames). Sem valor válido, não desenha nada. */
  frame?: string | null;
  /** Moldura parada (sem animação): usado em grades com muitas opções. */
  still?: boolean;
}) {
  const ringClass = ring ?? "ring-white/15";
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join("");

  const frameId = isAvatarFrameId(frame) ? frame : null;
  const plainRing = !!frameId;

  const photo = src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name}
      className={`avatar-photo ${SIZES[size]} shrink-0 rounded-full object-cover ring-2 ${plainRing ? "ring-transparent" : ringClass}`}
      referrerPolicy="no-referrer"
      loading="lazy"
      decoding="async"
    />
  ) : (
    <span
      className={`avatar-photo flex ${SIZES[size]} shrink-0 items-center justify-center rounded-full bg-brand-purple/25 font-semibold text-purple-200 ring-2 ${plainRing ? "ring-transparent" : ringClass}`}
    >
      {initials || "?"}
    </span>
  );

  const art = frameId ? <AvatarFrameArt id={frameId} still={still} /> : null;

  return <span className="relative inline-flex shrink-0">{photo}{art}</span>;
}
