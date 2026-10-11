"use client";

import { Fragment, useState, type ReactNode } from "react";
import { BarChart3, ChevronDown, ChevronUp, CheckCircle2 } from "lucide-react";
import { Avatar } from "./Avatar";
import { AnimatedMetric } from "./AnimatedMetric";
import { EmptyState } from "./EmptyState";

export type RankingEntry = {
  profileId: string;
  count: number;
  fullName: string;
  avatarUrl: string | null;
  displayValue?: string;
  detail?: string;
  /** false mantém a pessoa visível, mas fora das posições e do pódio. */
  ranked?: boolean;
};

const MEDAL_BADGE = [
  "border-yellow-300 bg-yellow-500/20 text-yellow-300",
  "border-white/15 bg-white/10 text-white/70",
  "border-orange-300 bg-orange-500/20 text-orange-300",
];

export function Leaderboard({
  title,
  icon,
  unit,
  ranking,
  currentProfileId,
  cutoff,
}: {
  title: string;
  icon: ReactNode;
  unit: string;
  ranking: RankingEntry[];
  currentProfileId?: string;
  /** Marca visualmente a linha de corte de uma quantidade fixa de vagas (ex: classificação pra um torneio). */
  cutoff?: { slots: number; label: string };
}) {
  const [showAll, setShowAll] = useState(false);
  const rankedEntries = ranking.filter((entry) => entry.ranked !== false);
  const classifyingEntries = ranking.filter((entry) => entry.ranked === false);
  const podium = rankedEntries.slice(0, 3);
  const remainingEntries = [...rankedEntries.slice(3), ...classifyingEntries];
  // Com corte ativo, garante que a linha (e pelo menos 1-2 pessoas depois dela)
  // fique visível sem precisar clicar em "ver todo mundo".
  const cutoffIndexInRest = cutoff && cutoff.slots > 3 ? cutoff.slots - 3 : null;
  const defaultRestCount = cutoffIndexInRest ? Math.max(7, cutoffIndexInRest + 2) : 7;
  const rest = showAll ? remainingEntries : remainingEntries.slice(0, defaultRestCount);
  const hasMore = remainingEntries.length > defaultRestCount;
  const podiumOrder = [podium[1], podium[0], podium[2]];
  const cutoffScore = cutoff && rankedEntries.length >= cutoff.slots ? rankedEntries[cutoff.slots - 1].count : null;

  return (
    <section className="min-w-0 rounded-xl border border-white/10 p-4 sm:p-6">
      <div className="flex items-center gap-2 text-white">
        {icon}
        <h2 className="font-semibold">{title}</h2>
      </div>

      {!ranking.length ? (
        <div className="mt-4"><EmptyState compact icon={<BarChart3 className="h-5 w-5" />} title="Ranking sendo formado" description="Os resultados aparecem aqui conforme os rachas e confrontos forem registrados." /></div>
      ) : (
        <>
          {podium.length > 0 && (
            <div className="mt-6 grid grid-cols-3 items-end gap-2 sm:gap-3">
              {podiumOrder.map((entry, slot) => {
                if (!entry) return <div key={slot} />;
                const place = podium.indexOf(entry);
                const isFirst = place === 0;
                const insideCutoff = Boolean(cutoff) && place + 1 <= (cutoff?.slots ?? 0);
                return (
                  <div key={entry.profileId} className={`podium-avatar flex min-w-0 flex-col items-center text-center ${isFirst ? "podium-avatar-first" : ""}`}>
                    <span
                      className={`mb-1.5 rounded-full border px-2 py-0.5 text-xs font-bold ${MEDAL_BADGE[place]}`}
                    >
                      <AnimatedMetric value={`${place + 1}º`} />
                    </span>
                    <Avatar
                      src={entry.avatarUrl}
                      name={entry.fullName}
                      size={isFirst ? "lg" : "md"}
                      ring={insideCutoff ? "ring-emerald-400/70" : undefined}
                    />
                    <p className="mt-2 w-full break-words text-sm font-medium text-white">
                      {entry.fullName}
                    </p>
                    {entry.profileId === currentProfileId && <span className="mt-1 rounded-full bg-purple-400/15 px-2 py-0.5 text-[9px] font-black text-purple-200">VOCÊ</span>}
                    {insideCutoff && (
                      <span className="mt-1 flex items-center gap-1 rounded-full bg-emerald-400/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-emerald-300">
                        <CheckCircle2 className="h-3 w-3" strokeWidth={2.5} />
                        Classificado
                      </span>
                    )}
                    <p className="text-xs text-white/60">
                      <AnimatedMetric value={entry.displayValue ?? `${entry.count} ${unit}`} />
                    </p>
                    {entry.detail && <p className="mt-0.5 text-[10px] text-white/40">{entry.detail}</p>}
                  </div>
                );
              })}
            </div>
          )}

          {rest.length > 0 && (
            <ul className="mt-6 divide-y divide-white/10 border-t border-white/10">
              {rest.map((entry, i) => {
                const rankedPosition = entry.ranked === false ? null : rankedEntries.indexOf(entry) + 1;
                const insideCutoff = Boolean(cutoff) && rankedPosition !== null && rankedPosition <= cutoff!.slots;
                const outsideCutoff = cutoffScore !== null && rankedPosition !== null && rankedPosition > cutoff!.slots;
                const gap = outsideCutoff ? Math.max(0, Math.round((cutoffScore! - entry.count) * 10) / 10) : null;
                return (
                  <Fragment key={entry.profileId}>
                    {cutoffIndexInRest !== null && i === cutoffIndexInRest && (
                      <li className="flex items-center gap-2 py-2 text-[10px] font-black uppercase tracking-wide text-emerald-300/80">
                        <span className="h-px flex-1 bg-emerald-300/30" />
                        {cutoff!.label}
                        <span className="h-px flex-1 bg-emerald-300/30" />
                      </li>
                    )}
                    <li
                      className={`flex min-w-0 items-center justify-between gap-2 rounded-lg px-2 py-2.5 text-sm ${
                        insideCutoff ? "border-l-2 border-emerald-400/60 bg-emerald-400/[0.06]" : ""
                      } ${entry.profileId === currentProfileId ? "bg-purple-400/10 ring-1 ring-purple-300/15" : ""}`}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <AnimatedMetric className={`w-6 shrink-0 text-center ${insideCutoff ? "text-emerald-300" : "text-white/40"}`} value={rankedPosition ? `${rankedPosition}º` : "—"} />
                        <Avatar src={entry.avatarUrl} name={entry.fullName} size="sm" ring={insideCutoff ? "ring-emerald-400/70" : undefined} />
                        <span className="min-w-0 break-words text-white">{entry.fullName}{entry.profileId === currentProfileId && <span className="ml-1 text-[9px] font-black text-purple-200">VOCÊ</span>}</span>
                        {insideCutoff && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-300" strokeWidth={2.5} />}
                      </span>
                      <span className="max-w-[52%] shrink-0 text-right text-white/60">
                        <AnimatedMetric className="block font-semibold" value={entry.displayValue ?? `${entry.count} ${unit}`} />
                        {entry.detail && <span className="mt-0.5 block text-[10px] leading-tight text-white/35">{entry.detail}</span>}
                        {insideCutoff && <span className="mt-0.5 block text-[10px] font-bold leading-tight text-emerald-300/80">classificado</span>}
                        {gap !== null && gap > 0 && <span className="mt-0.5 block text-[10px] font-bold leading-tight text-amber-300/80">faltam {gap.toFixed(1)} pts p/ vaga</span>}
                      </span>
                    </li>
                  </Fragment>
                );
              })}
            </ul>
          )}

          {hasMore && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/10 py-2 text-sm font-medium text-white/70 hover:bg-white/5"
            >
              {showAll ? (
                <>
                  Ver menos
                  <ChevronUp className="h-4 w-4" strokeWidth={2} />
                </>
              ) : (
                <>
                  Ver todo mundo ({ranking.length})
                  <ChevronDown className="h-4 w-4" strokeWidth={2} />
                </>
              )}
            </button>
          )}
        </>
      )}
    </section>
  );
}
