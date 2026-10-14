import { teamBrandFor, teamIconFor } from "@/lib/teamLogos";

/** Ícone do time + nome. Só apresentação; times sem logo mostram apenas o nome. */
export function TeamBadge({ name, size = 28, stacked = false, className = "" }: { name: string; size?: number; stacked?: boolean; className?: string }) {
  const icon = teamIconFor(name);
  const brand = teamBrandFor(name);
  return (
    <span className={`inline-flex min-w-0 items-center gap-1.5 ${stacked ? "flex-col text-center" : ""} ${className}`}>
      {icon && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={icon} alt="" aria-hidden="true" height={size} style={{ height: size, width: "auto", borderRadius: 6, border: `1px solid ${brand?.accent ?? "#fff"}66` }} className="shrink-0" />
      )}
      <span className="min-w-0 truncate">{name}</span>
    </span>
  );
}
