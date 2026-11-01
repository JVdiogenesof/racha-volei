import Link from "next/link";
import { ArrowRight, BadgeCheck, Trophy } from "lucide-react";

/** Aviso da Copa VPA na tela de início, com o mesmo visual vivo da capa da copa. */
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
  remaining: number;
  capacity: number;
  qualifiedCount: number;
  iAmQualified: boolean;
}) {
  const progress = Math.min(100, Math.round((qualifiedCount / Math.max(1, capacity)) * 100));

  return (
    <Link href={href} className="copa-frame block rounded-3xl transition active:scale-[0.99]">
      <div className="copa-hero copa-shine rounded-[22px] p-4">
        <span aria-hidden className="copa-orb -right-8 -top-10 h-32 w-32 bg-pink-400" />
        <span aria-hidden className="copa-orb copa-orb-slow -bottom-12 -left-8 h-32 w-32 bg-violet-500" />

        <div className="relative z-10 flex items-center gap-3">
          <span className="copa-float relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/25 bg-white/15">
            <Trophy className="h-6 w-6 text-white drop-shadow-[0_0_10px_rgba(244,114,182,0.9)]" strokeWidth={1.8} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="copa-pulse shrink-0 whitespace-nowrap rounded-full bg-pink-400 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-pink-950">Novo</span>
              <span className="truncate text-[10px] font-bold uppercase tracking-[0.08em] text-pink-100/85">
                Final {finalDateLabel}
                {remaining > 0 ? ` · faltam ${remaining} dia${remaining === 1 ? "" : "s"}` : remaining === 0 ? " · é hoje!" : ""}
              </span>
            </div>
            <p className="copa-title mt-0.5 truncate text-2xl font-black uppercase leading-tight">{name}</p>
            <p className="text-xs leading-snug text-white/80">
              {iAmQualified ? "Você está classificado(a) para a final!" : "Vença um racha classificatório e garanta sua vaga."}
            </p>
          </div>
          <ArrowRight className="h-5 w-5 shrink-0 text-white/80" strokeWidth={2.25} />
        </div>

        <div className="relative z-10 mt-3 flex items-center gap-2.5">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/15">
            <div className="copa-slot-on h-full rounded-full" style={{ width: `${progress}%` }} />
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-bold text-white">
            {iAmQualified && <BadgeCheck className="h-3.5 w-3.5 text-pink-200" strokeWidth={2.5} />}
            {qualifiedCount}/{capacity} classificados
          </span>
        </div>
      </div>
    </Link>
  );
}
