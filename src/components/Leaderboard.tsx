"use client";

import { Fragment, useState, type ReactNode } from "react";
import { BarChart3, ChevronDown, ChevronUp, CheckCircle2, Crown, Minus, Sparkles, TrendingDown, TrendingUp, Trophy } from "lucide-react";
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
  /** Movimento desde o racha anterior, usado pelo Índice VPA vivo. */
  trend?: "up" | "down" | "same" | "new";
  positionChange?: number | null;
};

// Pedestais do pódio: altura, cor da barra e cor do número de cada colocação.
const PODIUM_STYLE = [
  { height: "h-12", bar: "from-yellow-300/35 to-yellow-500/5", border: "border-yellow-300/40", text: "text-yellow-300" },
  { height: "h-9", bar: "from-white/25 to-white/0", border: "border-white/25", text: "text-white/75" },
  { height: "h-7", bar: "from-orange-300/30 to-orange-500/0", border: "border-orange-300/35", text: "text-orange-300" },
];

function TrendBadge({ entry }: { entry: RankingEntry }) {
  if (!entry.trend) return null;
  if (entry.trend === "new") return <span className="mt-1 inline-flex items-center gap-0.5 text-[9px] font-black uppercase tracking-wide text-sky-200"><Sparkles className="h-3 w-3" />novo</span>;
  if (entry.trend === "up") return <span className="mt-1 inline-flex items-center gap-0.5 text-[9px] font-black uppercase tracking-wide text-emerald-300"><TrendingUp className="h-3 w-3" />+{entry.positionChange}</span>;
  if (entry.trend === "down") return <span className="mt-1 inline-flex items-center gap-0.5 text-[9px] font-black uppercase tracking-wide text-rose-300"><TrendingDown className="h-3 w-3" />{entry.positionChange}</span>;
  return <span className="mt-1 inline-flex items-center gap-0.5 text-[9px] font-black uppercase tracking-wide text-white/35"><Minus className="h-3 w-3" />estável</span>;
}

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
  // Com corte ativo, garante que a linha (e pelo menos 2 pessoas depois dela)
  // fique visível sem precisar clicar em "ver todo mundo".
  const cutoffIndexInRest = cutoff && cutoff.slots > 3 ? cutoff.slots - 3 : null;
  const defaultRestCount = cutoffIndexInRest ? Math.max(7, cutoffIndexInRest + 2) : 7;
  const rest = showAll ? remainingEntries : remainingEntries.slice(0, defaultRestCount);
  const hasMore = remainingEntries.length > defaultRestCount;
  const podiumOrder = [podium[1], podium[0], podium[2]];
  const cutoffScore = cutoff && rankedEntries.length >= cutoff.slots ? rankedEntries[cutoff.slots - 1].count : null;
  const leaderCount = Math.max(0.0001, rankedEntries[0]?.count ?? 0);

  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025]">
      <header className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-2.5">
        <h2 className="flex min-w-0 items-center gap-2 text-sm font-bold text-white">
          {icon}
          <span className="truncate">{title}</span>
        </h2>
        <span className="shrink-0 rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-bold text-white/50">
          {rankedEntries.length} {rankedEntries.length === 1 ? "pessoa" : "pessoas"}
        </span>
      </header>

      {!ranking.length ? (
        <div className="p-4"><EmptyState compact icon={<BarChart3 className="h-5 w-5" />} title="Ranking sendo formado" description="Os resultados aparecem aqui conforme os rachas e confrontos forem registrados." /></div>
      ) : (
        <>
          {podium.length > 0 && (
            <div className="grid grid-cols-3 items-end gap-1.5 px-3 pt-5 sm:gap-3 sm:px-6">
              {podiumOrder.map((entry, slot) => {
                if (!entry) return <div key={slot} />;
                const place = podium.indexOf(entry);
                const isFirst = place === 0;
                const style = PODIUM_STYLE[place];
                const insideCutoff = Boolean(cutoff) && place + 1 <= (cutoff?.slots ?? 0);
                const isMe = entry.profileId === currentProfileId;
                return (
                  <div key={entry.profileId} className={`podium-avatar flex min-w-0 flex-col items-center text-center ${isFirst ? "podium-avatar-first" : ""}`}>
                    <div className="relative">
                      {isFirst && <Crown className="absolute -top-4 left-1/2 h-4 w-4 -translate-x-1/2 text-yellow-300" strokeWidth={2.25} fill="currentColor" fillOpacity={0.25} />}
                      <Avatar
                        src={entry.avatarUrl}
                        name={entry.fullName}
                        size={isFirst ? "lg" : "md"}
                        ring={insideCutoff ? "ring-emerald-400/70" : undefined}
                      />
                    </div>
                    <p className="mt-1.5 line-clamp-2 w-full px-0.5 text-[11px] font-semibold leading-tight text-white sm:text-sm">
                      {entry.fullName}
                      {isMe && <span className="ml-1 align-middle text-[8px] font-black text-purple-200">VOCÊ</span>}
                    </p>
                    <p className="mt-0.5 text-[11px] font-bold text-white/70 sm:text-xs">
                      <AnimatedMetric value={entry.displayValue ?? `${entry.count} ${unit}`} />
                    </p>
                    {entry.detail && <p className="line-clamp-1 w-full px-0.5 text-[9px] leading-tight text-white/35">{entry.detail}</p>}
                    <TrendBadge entry={entry} />
                    <div
                      className={`mt-1.5 flex w-full items-start justify-center gap-1 rounded-t-lg border border-b-0 bg-gradient-to-b pt-1 ${style.height} ${style.bar} ${style.border}`}
                    >
                      <span className={`text-sm font-black leading-none ${style.text}`}>
                        <AnimatedMetric value={`${place + 1}º`} />
                      </span>
                      {insideCutoff && (
                        <CheckCircle2 className="h-3 w-3 text-emerald-300" strokeWidth={2.5} aria-label="Classificado" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {rest.length > 0 && (
            <ul className="border-t border-white/10 px-2 py-1 sm:px-4">
              {rest.map((entry, i) => {
                const rankedPosition = entry.ranked === false ? null : rankedEntries.indexOf(entry) + 1;
                const insideCutoff = Boolean(cutoff) && rankedPosition !== null && rankedPosition <= cutoff!.slots;
                const outsideCutoff = cutoffScore !== null && rankedPosition !== null && rankedPosition > cutoff!.slots;
                const gap = outsideCutoff ? Math.max(0, Math.round((cutoffScore! - entry.count) * 10) / 10) : null;
                const isMe = entry.profileId === currentProfileId;
                const progress = rankedPosition ? Math.max(4, Math.min(100, (entry.count / leaderCount) * 100)) : 0;
                return (
                  <Fragment key={entry.profileId}>
                    {cutoffIndexInRest !== null && i === cutoffIndexInRest && (
                      <li className="my-1.5 flex items-center gap-2 text-[10px] font-black uppercase tracking-wide text-emerald-300">
                        <span className="h-px flex-1 border-t border-dashed border-emerald-300/40" />
                        <span className="flex items-center gap-1 rounded-full border border-emerald-300/30 bg-emerald-400/10 px-2 py-0.5">
                          <Trophy className="h-3 w-3" strokeWidth={2.5} />
                          {cutoff!.label}
                        </span>
                        <span className="h-px flex-1 border-t border-dashed border-emerald-300/40" />
                      </li>
                    )}
                    <li
                      className={`relative my-0.5 min-w-0 overflow-hidden rounded-xl px-2 py-1.5 ${
                        isMe ? "bg-purple-400/12 ring-1 ring-purple-300/25" : insideCutoff ? "bg-emerald-400/[0.05]" : "hover:bg-white/[0.03]"
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span className={`w-6 shrink-0 text-center text-xs font-black ${insideCutoff ? "text-emerald-300" : "text-white/35"}`}>
                          {rankedPosition ? `${rankedPosition}º` : "—"}
                        </span>
                        <Avatar src={entry.avatarUrl} name={entry.fullName} size="sm" ring={insideCutoff ? "ring-emerald-400/60" : undefined} />
                        <div className="min-w-0 flex-1">
                          <p className="flex min-w-0 items-center gap-1 text-[13px] font-medium leading-tight text-white">
                            <span className="truncate">{entry.fullName}</span>
                            {isMe && <span className="shrink-0 text-[8px] font-black text-purple-200">VOCÊ</span>}
                          </p>
                          {entry.detail && <p className="truncate text-[10px] leading-tight text-white/35">{entry.detail}</p>}
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="flex items-center justify-end gap-1 text-[13px] font-bold leading-tight text-white/80">
                            {insideCutoff && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" strokeWidth={2.5} aria-label="Classificado" />}
                            <AnimatedMetric value={entry.displayValue ?? `${entry.count} ${unit}`} />
                          </p>
                          <TrendBadge entry={entry} />
                          {gap !== null && gap > 0 && (
                            <p className="text-[10px] font-bold leading-tight text-amber-300/85">−{gap.toFixed(1)} p/ vaga</p>
                          )}
                        </div>
                      </div>
                      {rankedPosition !== null && (
                        <span className="mt-1 block h-0.5 overflow-hidden rounded-full bg-white/[0.06]">
                          <span
                            className={`block h-full rounded-full ${insideCutoff ? "bg-emerald-400/60" : "bg-purple-300/40"}`}
                            style={{ width: `${progress}%` }}
                          />
                        </span>
                      )}
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
              className="flex w-full items-center justify-center gap-1.5 border-t border-white/10 py-2.5 text-xs font-semibold text-white/60 transition hover:bg-white/5 hover:text-white"
            >
              {showAll ? (
                <>
                  Ver menos
                  <ChevronUp className="h-3.5 w-3.5" strokeWidth={2} />
                </>
              ) : (
                <>
                  Ver todo mundo ({ranking.length})
                  <ChevronDown className="h-3.5 w-3.5" strokeWidth={2} />
                </>
              )}
            </button>
          )}
        </>
      )}
    </section>
  );
}
