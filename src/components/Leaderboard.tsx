"use client";

import { Fragment, useState, type ReactNode } from "react";
import { BarChart3, ChevronDown, ChevronUp, CheckCircle2, Crown, Minus, TrendingDown, TrendingUp, Trophy, Volleyball } from "lucide-react";
import { Avatar } from "./Avatar";
import { AnimatedMetric } from "./AnimatedMetric";
import { EmptyState } from "./EmptyState";
import { getTournamentZone } from "@/lib/tournamentQualification";

/** Chip de estatística: quebra linha em vez de ser cortado no meio. */
export type RankingStat = { label: string; value: string; tone?: "default" | "good" | "bad" };

/** Uma parte do Índice: nota de 0 a 100, peso, e quanto ela rendeu na conta final. */
export type RankingBreakdownPart = { label: string; score: number; weight: number; points: number };

export type RankingEntry = {
  profileId: string;
  count: number;
  fullName: string;
  avatarUrl: string | null;
  displayValue?: string;
  detail?: string;
  /** Substitui o `detail` numa linha só: cada número ganha rótulo e nada fica cortado. */
  stats?: RankingStat[];
  /** Composição da nota, mostrada ao tocar na pessoa. */
  breakdown?: { parts: RankingBreakdownPart[]; bonus: number; total: number };
  /** false mantém a pessoa visível, mas fora das posições e do pódio. */
  ranked?: boolean;
  /** Movimento desde o racha anterior, usado pelo Índice VPA vivo. */
  trend?: "up" | "down" | "same" | "new";
  positionChange?: number | null;
  /** Quanto o Índice mudou em pontos desde o racha anterior. */
  indexChange?: number | null;
  /** Já garantiu vaga via pré-torneio -- fica "classificado" (verde) mesmo fora do corte pela nota. */
  guaranteed?: boolean;
  /** Rachas seguidos presente: a partir de 3 a foto ganha o anel de fogo. */
  streak?: number;
};

const STAT_TONE: Record<NonNullable<RankingStat["tone"]>, string> = {
  default: "border-white/10 bg-white/[0.04] text-white/60",
  good: "border-emerald-300/20 bg-emerald-400/10 text-emerald-200/90",
  bad: "border-rose-300/20 bg-rose-400/10 text-rose-200/90",
};

// Sobre o fundo roxo do topo: vidro escuro, com o texto mais claro pra ler bem.
const STAT_TONE_GLASS: Record<NonNullable<RankingStat["tone"]>, string> = {
  default: "border-white/15 bg-black/25 text-white/80",
  good: "border-emerald-300/30 bg-emerald-950/40 text-emerald-200",
  bad: "border-rose-300/30 bg-rose-950/40 text-rose-200",
};

function StatChips({ stats, className = "", glass = false }: { stats: RankingStat[]; className?: string; glass?: boolean }) {
  const tones = glass ? STAT_TONE_GLASS : STAT_TONE;
  return (
    <div className={`flex flex-wrap items-center gap-1 ${className}`}>
      {stats.map((stat) => (
        <span
          key={stat.label}
          className={`inline-flex items-baseline gap-1 rounded-md border px-1.5 py-0.5 text-[10px] leading-tight ${tones[stat.tone ?? "default"]}`}
        >
          <span className="font-semibold uppercase tracking-wide opacity-60">{stat.label}</span>
          <span className="font-bold tabular-nums">{stat.value}</span>
        </span>
      ))}
    </div>
  );
}

/** Mostra a conta do Índice: cada parte, quanto ela rendeu, e o total. */
function BreakdownPanel({ breakdown, trendText }: { breakdown: NonNullable<RankingEntry["breakdown"]>; trendText?: string | null }) {
  return (
    <div className="mt-2 rounded-lg border border-white/10 bg-black/20 p-2.5">
      <p className="mb-2 text-[9px] font-black uppercase tracking-wide text-white/35">Como essa nota foi formada</p>
      <div className="space-y-1.5">
        {breakdown.parts.map((part) => (
          <div key={part.label} className="grid grid-cols-[1fr_auto] items-center gap-x-2 gap-y-1">
            <span className="flex min-w-0 items-baseline gap-1.5">
              <span className="break-words text-[11px] font-medium text-white/70">{part.label}</span>
              <span className="shrink-0 rounded bg-white/[0.06] px-1 text-[9px] font-bold text-white/40">
                {Math.round(part.weight * 100)}%
              </span>
            </span>
            <span className="shrink-0 text-right text-[11px] font-bold tabular-nums text-white/80">
              {part.points.toFixed(1)} pts
            </span>
            <span className="col-span-2 flex items-center gap-2">
              <span className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                <span className="block h-full rounded-full bg-purple-300/50" style={{ width: `${Math.max(2, Math.min(100, part.score))}%` }} />
              </span>
              <span className="w-16 shrink-0 text-right text-[9px] tabular-nums text-white/35">nota {part.score.toFixed(1)}</span>
            </span>
          </div>
        ))}
        {breakdown.bonus > 0 && (
          <div className="flex items-center justify-between gap-2 pt-0.5">
            <span className="text-[11px] font-medium text-emerald-300/80">Evolução de forma</span>
            <span className="text-[11px] font-bold tabular-nums text-emerald-300/80">+{breakdown.bonus.toFixed(1)} pts</span>
          </div>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 border-t border-white/10 pt-1.5">
        <span className="text-[11px] font-black uppercase tracking-wide text-white/50">Índice</span>
        <span className="text-sm font-black tabular-nums text-white">{breakdown.total.toFixed(1)}</span>
      </div>
      {trendText && <p className="mt-1.5 break-words text-[10px] leading-snug text-white/55">{trendText}</p>}
    </div>
  );
}

type Tier = "green" | "blue" | "red";

const TIER_STYLE: Record<Tier, { ring: string; text: string; bg: string; progress: string }> = {
  green: { ring: "ring-emerald-400/70", text: "text-emerald-300", bg: "bg-emerald-400/[0.05]", progress: "bg-emerald-400/60" },
  blue: { ring: "ring-sky-400/70", text: "text-sky-300", bg: "bg-sky-400/[0.05]", progress: "bg-sky-400/60" },
  red: { ring: "ring-rose-400/60", text: "text-rose-300", bg: "", progress: "bg-purple-300/40" },
};

/**
 * Faixa de cor dentro do corte de classificação: garantidos e top 10 = verde,
 * até o fim da zona = azul, depois = vermelho. `zoneEnd` já desconta quem
 * garantiu vaga no pré-torneio.
 */
function tierFor(rankedPosition: number | null, zoneEnd: number | null, guaranteed?: boolean): Tier | null {
  if (guaranteed) return "green";
  if (zoneEnd === null || rankedPosition === null) return null;
  if (rankedPosition > zoneEnd) return "red";
  return rankedPosition <= 10 ? "green" : "blue";
}

function hasMoreDetails(entry: RankingEntry) {
  return Boolean(entry.stats?.length || entry.breakdown || (entry.ranked !== false && entry.detail));
}

// Pedestais do pódio: altura, cor da barra e cor do número de cada colocação.
const PODIUM_STYLE = [
  { height: "h-16", medal: "from-yellow-200 to-yellow-500 text-yellow-950" },
  { height: "h-12", medal: "from-slate-100 to-slate-400 text-slate-900" },
  { height: "h-10", medal: "from-orange-200 to-orange-500 text-orange-950" },
];

/** Variação em pontos com uma casa; some quando é praticamente zero (evita "+0.0"). */
function pointsChangeOf(entry: RankingEntry) {
  const points = entry.indexChange;
  return points != null && Math.abs(points) >= 0.05 ? points : null;
}

const signedPoints = (value: number) => `${value > 0 ? "+" : "−"}${Math.abs(value).toFixed(1)}`;

/** Frase completa do movimento desde o racha anterior, para o "Ver mais" e o toque longo. */
function trendSentence(entry: RankingEntry) {
  if (!entry.trend) return null;
  if (entry.trend === "new") return "Entrou na classificação neste racha.";
  const places = Math.abs(entry.positionChange ?? 0);
  const noun = places === 1 ? "posição" : "posições";
  const move = entry.trend === "up" ? `Subiu ${places} ${noun}` : entry.trend === "down" ? `Caiu ${places} ${noun}` : "Manteve a posição";
  const points = pointsChangeOf(entry);
  return `${move}${points !== null ? ` (${signedPoints(points)} pts)` : ""} desde o racha anterior.`;
}

function TrendBadge({ entry }: { entry: RankingEntry }) {
  if (!entry.trend) return null;
  if (entry.trend === "new") return <span className="mt-1 inline-flex items-center rounded-full bg-sky-400/20 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-sky-100">novo</span>;
  const points = pointsChangeOf(entry);
  const positionTone = entry.trend === "up" ? "text-emerald-300" : entry.trend === "down" ? "text-rose-300" : "text-white/35";
  const Icon = entry.trend === "up" ? TrendingUp : entry.trend === "down" ? TrendingDown : Minus;
  // Posições e pontos na mesma linha; se faltar espaço, a segunda parte desce para
  // a linha de baixo em vez de ser cortada.
  return (
    <span title={trendSentence(entry) ?? undefined} className="mt-1 flex max-w-[8.5rem] flex-wrap items-center justify-end gap-x-1.5 text-[9px] font-black leading-tight tracking-wide">
      <span className={`inline-flex items-center gap-0.5 uppercase ${positionTone}`}>
        <Icon className="h-3 w-3" />
        {entry.trend === "up" ? `+${entry.positionChange}` : entry.trend === "down" ? entry.positionChange : "estável"}
      </span>
      {points !== null && <span className={`tabular-nums ${points > 0 ? "text-emerald-300/90" : "text-rose-300/90"}`}>{signedPoints(points)} pts</span>}
    </span>
  );
}

export function Leaderboard({
  title,
  icon,
  unit,
  ranking,
  currentProfileId,
  cutoff,
  eyebrow,
  badge,
  footer,
  belowList,
}: {
  title: string;
  /** Linha pequena acima do título do topo (ex.: "Quadra · 8 rachas"). */
  eyebrow: string;
  badge?: string;
  /** Mostrado dentro do topo, abaixo do pódio (ex.: "Sua posição"). */
  footer?: ReactNode;
  /** Mostrado depois da lista (ex.: faixa de resumo e "como funciona"). */
  belowList?: ReactNode;
  icon: ReactNode;
  unit: string;
  ranking: RankingEntry[];
  currentProfileId?: string;
  /** Marca visualmente a linha de corte de uma quantidade fixa de vagas (ex: classificação pra um torneio). */
  cutoff?: { slots: number; label: string };
}) {
  const [showAll, setShowAll] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const rankedEntries = ranking.filter((entry) => entry.ranked !== false);
  const classifyingEntries = ranking.filter((entry) => entry.ranked === false);
  const podium = rankedEntries.slice(0, 3);
  const remainingEntries = [...rankedEntries.slice(3), ...classifyingEntries];
  // Com corte ativo, garante que a linha (e pelo menos 2 pessoas depois dela)
  // fique visível sem precisar clicar em "ver todo mundo".
  const zone = cutoff
    ? getTournamentZone(
        rankedEntries.map((entry) => entry.profileId),
        new Set(rankedEntries.filter((entry) => entry.guaranteed).map((entry) => entry.profileId)),
        cutoff.slots,
      )
    : null;
  const zoneEnd = zone ? zone.zoneEnd : null;
  const cutoffPosition = zone?.cutoffPosition ?? null;
  const cutoffIndexInRest = cutoffPosition !== null && cutoffPosition > 3 ? cutoffPosition - 3 : null;
  const defaultRestCount = cutoffIndexInRest ? Math.max(7, cutoffIndexInRest + 2) : 7;
  const rest = showAll ? remainingEntries : remainingEntries.slice(0, defaultRestCount);
  const hasMore = remainingEntries.length > defaultRestCount;
  const podiumOrder = [podium[1], podium[0], podium[2]];
  const podiumExpanded = podium.find((entry) => entry?.profileId === expandedId) ?? null;
  const cutoffScore = cutoffPosition !== null ? rankedEntries[cutoffPosition - 1].count : null;
  const leaderCount = Math.max(0.0001, rankedEntries[0]?.count ?? 0);

  return (
    <div className="space-y-2">
      <header className="copa-frame rounded-[28px]">
        <div className="copa-hero theme-ranking copa-shine rounded-[26px] px-3 pb-3 pt-4 sm:px-6 sm:pb-5 sm:pt-5">
          <span aria-hidden className="copa-orb -left-10 -top-12 h-40 w-40 bg-fuchsia-400" />
          <span aria-hidden className="copa-orb copa-orb-slow -bottom-16 -right-10 h-48 w-48 bg-violet-500" />
          {["left-[10%] top-[16%]", "left-[84%] top-[10%]", "left-[70%] top-[50%]", "left-[18%] top-[62%]"].map((position, index) => (
            <span key={position} aria-hidden className={`copa-twinkle absolute h-1.5 w-1.5 rounded-full bg-white ${position}`} style={{ animationDelay: `${index * 0.5}s` }} />
          ))}

          <div className="relative z-10 px-1">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-fuchsia-100/90">
                <Volleyball className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} />
                {eyebrow}
              </p>
              {badge && <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[10px] font-bold text-white">{badge}</span>}
            </div>
            <h1 className="copa-title mt-1.5 text-[28px] font-black uppercase leading-[1.05] tracking-tight sm:text-5xl">{title}</h1>
          </div>

          {podium.length > 0 && (
            <div className="relative z-10 mt-4 grid grid-cols-[repeat(3,minmax(0,1fr))] items-end gap-1.5 sm:gap-3">
              {podiumOrder.map((entry, slot) => {
                if (!entry) return <div key={slot} />;
                const place = podium.indexOf(entry);
                const isFirst = place === 0;
                const style = PODIUM_STYLE[place];
                const podiumTier = tierFor(place + 1, zoneEnd, entry.guaranteed);
                const insideCutoff = podiumTier === "green" || podiumTier === "blue";
                const isMe = entry.profileId === currentProfileId;
                const podiumHasMore = hasMoreDetails(entry);
                const podiumOpen = expandedId === entry.profileId;
                const Wrapper = podiumHasMore ? "button" : "div";
                return (
                  <Wrapper
                    key={entry.profileId}
                    {...(podiumHasMore
                      ? {
                          type: "button" as const,
                          onClick: () => setExpandedId((id) => (id === entry.profileId ? null : entry.profileId)),
                          "aria-expanded": expandedId === entry.profileId,
                          "aria-label": `Ver mais de ${entry.fullName}`,
                        }
                      : {})}
                    className={`podium-avatar flex min-w-0 flex-col items-center text-center ${isFirst ? "podium-avatar-first" : ""} ${podiumHasMore ? "cursor-pointer rounded-xl transition hover:bg-white/[0.06]" : ""}`}
                  >
                    <div className="relative">
                      {isFirst && (
                        <span className="copa-float absolute -top-6 left-1/2 -translate-x-1/2">
                          <Crown className="h-6 w-6 text-yellow-200 drop-shadow-[0_0_10px_rgba(253,224,71,0.9)]" strokeWidth={2} fill="currentColor" fillOpacity={0.25} />
                        </span>
                      )}
                      <Avatar
                        src={entry.avatarUrl}
                        name={entry.fullName}
                        size={isFirst ? "lg" : "md"}
                        streak={entry.streak}
                        ring={podiumTier ? TIER_STYLE[podiumTier].ring : "ring-white/40"}
                      />
                    </div>
                    <p className="mt-1.5 w-full break-words px-0.5 text-[12px] font-bold leading-tight text-white sm:text-sm">
                      {entry.fullName}
                      {isMe && <span className="ml-1 align-middle text-[8px] font-black text-fuchsia-200">VOCÊ</span>}
                    </p>
                    <p className="mt-0.5 text-[12px] font-black tabular-nums text-white sm:text-sm">
                      <AnimatedMetric value={entry.displayValue ?? `${entry.count} ${unit}`} />
                    </p>
                    {podiumHasMore && (
                      <span className="mt-1 inline-flex items-center gap-0.5 text-[11px] font-semibold text-white/75">
                        {podiumOpen ? "Ver menos" : "Ver mais"}
                        <ChevronDown className={`h-3 w-3 transition-transform ${podiumOpen ? "rotate-180" : ""}`} strokeWidth={2.5} />
                      </span>
                    )}
                    <TrendBadge entry={entry} />
                    <div
                      className={`mt-1.5 flex w-full items-start justify-center gap-1.5 rounded-t-xl border border-b-0 border-white/20 bg-gradient-to-b from-white/25 to-white/5 pt-1.5 ${style.height}`}
                    >
                      <span className={`flex h-6 min-w-6 items-center justify-center rounded-full bg-gradient-to-br px-1 text-[11px] font-black ${style.medal}`}>
                        <AnimatedMetric value={`${place + 1}º`} />
                      </span>
                      {insideCutoff && podiumTier && (
                        <CheckCircle2 className={`mt-1 h-4 w-4 ${TIER_STYLE[podiumTier].text}`} strokeWidth={2.5} aria-label="Classificado" />
                      )}
                    </div>
                  </Wrapper>
                );
              })}
            </div>
          )}

          {podiumExpanded && hasMoreDetails(podiumExpanded) && (
            <div className="relative z-10 mt-3 rounded-xl bg-black/20 px-2.5 pb-2.5 pt-2">
              <p className="text-[11px] font-bold text-white/80">{podiumExpanded.fullName}</p>
              {podiumExpanded.stats?.length ? <StatChips stats={podiumExpanded.stats} glass className="mt-1.5" /> : null}
              {!podiumExpanded.stats?.length && podiumExpanded.detail ? (
                <p className="mt-1 break-words text-[11px] leading-tight text-white/70">{podiumExpanded.detail}</p>
              ) : null}
              {podiumExpanded.breakdown && <BreakdownPanel breakdown={podiumExpanded.breakdown} trendText={trendSentence(podiumExpanded)} />}
            </div>
          )}

          {footer && <div className="relative z-10 mt-2.5">{footer}</div>}
        </div>
      </header>

    <section className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025]">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-2.5">
        <h2 className="flex min-w-0 items-center gap-2 text-sm font-bold text-white">
          {icon}
          <span>Classificação completa</span>
        </h2>
        <span className="shrink-0 rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-bold text-white/60">
          {rankedEntries.length} {rankedEntries.length === 1 ? "pessoa" : "pessoas"}
        </span>
      </header>

      {!ranking.length ? (
        <div className="p-4"><EmptyState compact icon={<BarChart3 className="h-5 w-5" />} title="Ranking sendo formado" description="Os resultados aparecem aqui conforme os rachas e confrontos forem registrados." /></div>
      ) : (
        <>
          {rest.length > 0 && (
            <ul className="border-t border-white/10 px-2 py-1 sm:px-4">
              {rest.map((entry, i) => {
                const rankedPosition = entry.ranked === false ? null : rankedEntries.indexOf(entry) + 1;
                const tier = tierFor(rankedPosition, zoneEnd, entry.guaranteed);
                const rowHasMore = hasMoreDetails(entry);
                const insideCutoff = tier === "green" || tier === "blue";
                const outsideCutoff = tier === "red";
                const gap = outsideCutoff && cutoffScore !== null ? Math.max(0, Math.round((cutoffScore! - entry.count) * 10) / 10) : null;
                const isMe = entry.profileId === currentProfileId;
                const progress = rankedPosition ? Math.max(4, Math.min(100, (entry.count / leaderCount) * 100)) : 0;
                const isExpanded = expandedId === entry.profileId;
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
                        isMe ? "bg-purple-400/12 ring-1 ring-purple-300/25" : tier ? TIER_STYLE[tier].bg : "hover:bg-white/[0.03]"
                      }`}
                    >
                      <div className="flex min-w-0 items-start gap-2">
                        <span className={`w-6 shrink-0 pt-1.5 text-center text-xs font-black ${tier ? TIER_STYLE[tier].text : "text-white/35"}`}>
                          {rankedPosition ? `${rankedPosition}º` : "—"}
                        </span>
                        <span className="shrink-0 pt-0.5">
                          <Avatar src={entry.avatarUrl} name={entry.fullName} size="sm" streak={entry.streak} ring={tier ? TIER_STYLE[tier].ring : undefined} />
                        </span>
                        <div className="min-w-0 flex-1 pt-0.5">
                          <p className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[13px] font-medium leading-tight text-white">
                            <span className="break-words">{entry.fullName}</span>
                            {isMe && <span className="shrink-0 text-[8px] font-black text-purple-200">VOCÊ</span>}
                            {entry.guaranteed && (
                              <span className="shrink-0 rounded-full bg-emerald-400/15 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide text-emerald-300">
                                Pré-torneio
                              </span>
                            )}
                          </p>
                          {entry.ranked === false && entry.detail ? (
                            <p className="break-words text-[10px] leading-tight text-white/50">{entry.detail}</p>
                          ) : null}
                          {rowHasMore && (
                            <button
                              type="button"
                              onClick={() => setExpandedId((id) => (id === entry.profileId ? null : entry.profileId))}
                              aria-expanded={isExpanded}
                              className="mt-0.5 inline-flex min-h-6 items-center gap-0.5 text-[11px] font-semibold text-purple-200/80 transition hover:text-white"
                            >
                              {isExpanded ? "Ver menos" : "Ver mais"}
                              <ChevronDown className={`h-3 w-3 transition-transform ${isExpanded ? "rotate-180" : ""}`} strokeWidth={2.5} />
                            </button>
                          )}
                        </div>
                        <div className="shrink-0 pt-0.5 text-right">
                          <p className="flex items-center justify-end gap-1 text-[13px] font-bold leading-tight text-white/80">
                            {insideCutoff && tier && <CheckCircle2 className={`h-3.5 w-3.5 ${TIER_STYLE[tier].text}`} strokeWidth={2.5} aria-label="Classificado" />}
                            <AnimatedMetric value={entry.displayValue ?? `${entry.count} ${unit}`} />
                          </p>
                          <TrendBadge entry={entry} />
                          {gap !== null && gap > 0 && (
                            <p className="text-[10px] font-bold leading-tight text-rose-300/85">−{gap.toFixed(1)} p/ vaga</p>
                          )}
                        </div>
                      </div>
                      {rankedPosition !== null && (
                        <span className="mt-1 block h-0.5 overflow-hidden rounded-full bg-white/[0.06]">
                          <span
                            className={`block h-full rounded-full ${tier ? TIER_STYLE[tier].progress : "bg-purple-300/40"}`}
                            style={{ width: `${progress}%` }}
                          />
                        </span>
                      )}
                      {rowHasMore && isExpanded && (
                        <div className="mt-2 space-y-2">
                          {entry.stats?.length ? <StatChips stats={entry.stats} /> : null}
                          {!entry.stats?.length && entry.ranked !== false && entry.detail ? (
                            <p className="break-words text-[11px] leading-tight text-white/60">{entry.detail}</p>
                          ) : null}
                          {entry.breakdown && <BreakdownPanel breakdown={entry.breakdown} trendText={trendSentence(entry)} />}
                        </div>
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

      {belowList}
    </div>
  );
}
