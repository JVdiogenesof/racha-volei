import { teamIdentity } from "@/lib/copaDraw";
import { teamBrandFor } from "@/lib/teamLogos";

/** Logo oficial do time (a mesma dos rachas normais). O tamanho é a altura, em pixels. */
export function CopaTeamLogo({ slug, size = 64, className }: { slug: string; size?: number; className?: string }) {
  const team = teamIdentity(slug);
  const brand = teamBrandFor(team.name);
  if (!brand) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={brand.logoWeb}
      alt={`Logo do time ${team.name}`}
      height={size}
      style={{ height: size, width: "auto", filter: `drop-shadow(0 6px 14px ${brand.glow})` }}
      className={className}
      decoding="async"
    />
  );
}
