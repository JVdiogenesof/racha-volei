import Link from "next/link";
import { ArrowRight, BadgeCheck, Trophy } from "lucide-react";

/** Aviso da Copa VPA na tela de início, compacto, com o mesmo visual vivo da capa da copa. */
export function CopaHomeCard({
  href,
  name,
  finalDateLabel,
  remaining,
  capacity,
  qualifiedCount,
  iAmQualified,
}: {
  href: string;
  name: string;
  finalDateLabel: string;
  remaining: number | null;
  capacity: number;
  qualifiedCount: number;
  iAmQualified: boolean;
}) {
  const progress = Math.min(100, Math.round((qualifiedCount / Math.max(1, capacity)) * 100));

  return (
    <Link href={href} className="copa-frame block rounded-2xl transition active:scale-[0.99]">
      <div className="copa-hero copa-shine rounded-[14px] px-3 py-2.5">
        <span aria-hidden className="copa-orb -right-8 -top-10 h-28 w-28 bg-pink-400" />

        <div className="relative z-10 flex items-center gap-2.5">
          <span className="copa-float flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/25 bg-white/15">
            <Trophy className="h-5 w-5 text-white drop-shadow-[0_0_10px_rgba(244,114,182,0.9)]" strokeWidth={1.8} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
              <span className="copa-pulse shrink-0 whitespace-nowrap rounded-full bg-pink-400 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-pink-950">Novo</span>
              <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-pink-100/85">
                Final {finalDateLabel}
                {remaining === null ? "" : remaining > 0 ? ` · faltam ${remaining} dia${remaining === 1 ? "" : "s"}` : remaining === 0 ? " · é hoje!" : ""}
              </span>
            </div>
            <p className="copa-title break-words text-xl font-black uppercase leading-tight">{name}</p>
          </div>
          <ArrowRight className="h-5 w-5 shrink-0 text-white/80" strokeWidth={2.25} />
        </div>

        <div className="relative z-10 mt-2 flex items-center gap-2.5">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/15">
            <div className="copa-slot-on h-full rounded-full" style={{ width: `${progress}%` }} />
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-bold text-white">
            {iAmQualified && <BadgeCheck className="h-3.5 w-3.5 text-pink-200" strokeWidth={2.5} />}
            {iAmQualified ? "Você está classificado(a) · " : ""}
            {qualifiedCount}/{capacity}
          </span>
        </div>
      </div>
    </Link>
  );
}
