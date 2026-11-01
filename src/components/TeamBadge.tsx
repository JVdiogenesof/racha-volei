import { teamBrandFor, teamIconWebFor } from "@/lib/teamLogos";

/** Ícone do time + nome. Só apresentação; times sem logo mostram apenas o nome. */
export function TeamBadge({ name, size = 28, stacked = false, className = "", hint }: { name: string; size?: number; stacked?: boolean; className?: string; hint?: string | null }) {
  const icon = teamIconWebFor(name);
  const brand = teamBrandFor(name);
  const badge = (
    <span className={`inline-flex min-w-0 items-center gap-1.5 ${stacked ? "flex-col text-center" : ""} ${className}`}>
      {icon && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={icon} alt="" aria-hidden="true" height={size} style={{ height: size, width: "auto", borderRadius: 6, border: `1px solid ${brand?.accent ?? "#fff"}66` }} className="shrink-0" />
      )}
      <span className="min-w-0 truncate">{name}</span>
    </span>
  );
  if (!hint) return badge;
  // Um jogador do time embaixo do nome, pra o organizador achar o time na quadra.
  return (
    <span className={`inline-flex min-w-0 flex-col ${stacked ? "items-center text-center" : "items-start"}`}>
      {badge}
      <span className="mt-0.5 block max-w-full break-words text-[11px] font-normal leading-tight text-white/55">com {hint}</span>
    </span>
  );
}
