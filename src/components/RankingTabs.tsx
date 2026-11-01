"use client";

import { useState } from "react";
import { CalendarCheck, CheckCircle2, Gauge, Info, Star, Swords, Target, type LucideIcon } from "lucide-react";
import { Leaderboard, type RankingEntry } from "./Leaderboard";
import { AnimatedMetric } from "./AnimatedMetric";
import { ROLLING_INDEX_EVENT_COUNT } from "@/lib/seasonRanking";

type RankingId = "performance" | "wins" | "mvp" | "attendance";

const CONFIG: Record<RankingId, { label: string; shortLabel: string; unit: string; description: string; icon: LucideIcon }> = {
  performance: { label: "Índice VPA", shortLabel: "Índice", unit: "pontos", description: "", icon: Gauge },
  wins: { label: "Mais vitórias", shortLabel: "Vitórias", unit: "vitórias", description: "Total de confrontos vencidos por cada jogador.", icon: Swords },
  mvp: { label: "Jogador Destaque", shortLabel: "Destaque", unit: "vezes", description: "Quantidade de vezes em que a pessoa foi eleita destaque do racha.", icon: Star },
  attendance: { label: "Mais presença", shortLabel: "Presença", unit: "presenças", description: "Participações confirmadas em rachas que já foram encerrados.", icon: CalendarCheck },
};

export function RankingTabs({
  currentProfileId,
  rankings,
  qualifying,
  eyebrow,
  badge,
}: {
  currentProfileId: string;
  rankings: Record<RankingId, RankingEntry[]>;
  /** Linha pequena do topo (ex.: "Quadra · 8 rachas"). */
  eyebrow: string;
  badge?: string;
  /** Corte de vagas pro torneio oficial, mostrado só na aba do Índice VPA. */
  qualifying?: { slots: number; label: string };
}) {
  const [active, setActive] = useState<RankingId>("performance");
  const [showInfo, setShowInfo] = useState(false);
  const ids = Object.keys(CONFIG) as RankingId[];
  const activeConfig = CONFIG[active];
  const ActiveIcon = activeConfig.icon;
  const cutoff = active === "performance" ? qualifying : undefined;

  function currentEntry(id: RankingId) {
    const ranking = rankings[id];
    const index = ranking.findIndex((entry) => entry.profileId === currentProfileId);
    const entry = index >= 0 ? ranking[index] : null;
    const position = entry && entry.ranked !== false
      ? ranking.filter((item) => item.ranked !== false).findIndex((item) => item.profileId === currentProfileId) + 1
      : null;
    return { entry, position };
  }

  const mine = currentEntry(active);
  const rankedActive = rankings[active].filter((item) => item.ranked !== false);
  const cutoffScore = cutoff && rankedActive.length >= cutoff.slots ? rankedActive[cutoff.slots - 1].count : null;
  const isQualified = Boolean(cutoff && mine.entry && (mine.entry.guaranteed || (mine.position && mine.position <= cutoff.slots)));
  const missing = cutoff && mine.position && !isQualified && cutoffScore !== null && mine.entry
    ? Math.max(0, Math.round((cutoffScore - mine.entry.count) * 10) / 10)
    : null;

  const positionCard = (
    <div className="flex min-w-0 flex-wrap items-center gap-3 rounded-2xl border border-white/15 bg-black/25 px-3 py-2.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white">
        <ActiveIcon className="h-4.5 w-4.5" strokeWidth={2.25} />
      </span>
      <div className="min-w-0 flex-1 basis-40">
        <p className="text-[10px] font-bold uppercase tracking-wide text-white/60">Sua posição · {activeConfig.label}</p>
        <p className="flex flex-wrap items-baseline gap-x-2 text-white">
          <AnimatedMetric className="text-xl font-black leading-tight" value={mine.position ? `${mine.position}º` : "—"} />
          <span className="text-xs font-medium text-white/70">
            {mine.entry ? (mine.position ? mine.entry.displayValue ?? `${mine.entry.count} ${activeConfig.unit}` : mine.entry.detail ?? "Em classificação") : "Ainda sem registros"}
          </span>
        </p>
      </div>
      {cutoff && mine.position && (
        isQualified ? (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-400/20 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-200">
            <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2.5} />
            Classificado
          </span>
        ) : missing !== null && missing > 0 ? (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-amber-400/20 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-amber-200">
            <Target className="h-3.5 w-3.5" strokeWidth={2.5} />
            −{missing.toFixed(1)} p/ vaga
          </span>
        ) : null
      )}
    </div>
  );

  const summaryTiles = cutoff ? (
    <div className="grid grid-cols-3 gap-2">
      {[
        { label: "Zona", value: `Top ${cutoff.slots}`, detail: "vagas no torneio" },
        { label: "Top 10", value: "Verde", detail: "em destaque" },
        { label: "Peso", value: "2,5x", detail: "nos 4 rachas mais recentes" },
      ].map((tile) => (
        <div key={tile.label} className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2">
          <p className="text-[9px] font-bold uppercase tracking-wider text-white/50">{tile.label}</p>
          <p className="text-base font-black text-white">{tile.value}</p>
          <p className="break-words text-[10px] leading-tight text-white/55">{tile.detail}</p>
        </div>
      ))}
    </div>
  ) : null;

  const infoBox = (
    <div className="rounded-xl border border-white/10 bg-white/[0.02]">
      <button
        type="button"
        onClick={() => setShowInfo((v) => !v)}
        aria-expanded={showInfo}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[11px] font-semibold text-white/55 transition hover:text-white/80"
      >
        <span className="flex items-center gap-1.5">
          <Info className="h-3.5 w-3.5 text-purple-300" strokeWidth={2.25} />
          Como funciona o {activeConfig.label}
        </span>
        <span className="text-white/30">{showInfo ? "fechar" : "ver"}</span>
      </button>
      {showInfo && (
        <div className="border-t border-white/10 px-3 py-2.5 text-xs leading-relaxed text-white/55">
          {active === "performance" ? (
            <div className="space-y-2">
              <p>A nota junta três coisas. Toque em qualquer pessoa pra ver a conta dela:</p>
              <ul className="space-y-1">
                <li className="flex gap-2">
                  <span className="w-9 shrink-0 rounded bg-white/[0.06] text-center font-bold text-white/70">55%</span>
                  <span><strong className="text-white/75">Aproveitamento</strong> — % de vitórias. Com poucos jogos, a nota fica mais perto de 50 até você jogar o suficiente.</span>
                </li>
                <li className="flex gap-2">
                  <span className="w-9 shrink-0 rounded bg-white/[0.06] text-center font-bold text-white/70">35%</span>
                  <span><strong className="text-white/75">Presença</strong> — quanto você apareceu nos últimos {ROLLING_INDEX_EVENT_COUNT} rachas.</span>
                </li>
                <li className="flex gap-2">
                  <span className="w-9 shrink-0 rounded bg-white/[0.06] text-center font-bold text-white/70">10%</span>
                  <span><strong className="text-white/75">Saldo de pontos</strong> — se você ganha/perde apertado ou folgado.</span>
                </li>
              </ul>
              <p className="rounded-lg border border-purple-300/15 bg-purple-400/[0.07] px-2.5 py-2">
                <strong className="text-purple-200">Os 4 rachas mais recentes valem 2,5x</strong> os mais antigos. Por isso dá pra ter mais vitórias no total e mesmo assim ficar atrás: o que conta mais é como você está agora, e faltar num racha recente pesa bem mais do que num antigo.
              </p>
              <p>Melhorar de forma de verdade ainda rende até 5 pontos de bônus. Precisa de 2 participações pra entrar na classificação.</p>
            </div>
          ) : (
            <p>{activeConfig.description}</p>
          )}
          {cutoff && <span className="mt-1.5 block font-semibold text-emerald-300/80">As {cutoff.slots} primeiras posições garantem vaga no torneio oficial de abril/2027 (número provisório).</span>}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-1 rounded-2xl border border-white/10 bg-white/[0.03] p-1">
        {ids.map((id) => {
          const config = CONFIG[id];
          const Icon = config.icon;
          const selected = active === id;
          const position = currentEntry(id).position;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setActive(id)}
              aria-pressed={selected}
              className={`flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-center text-[11px] font-semibold leading-tight transition sm:flex-row sm:gap-1.5 sm:text-xs ${selected ? "bg-brand-purple text-white shadow-md shadow-purple-950/30" : "text-white/55 hover:bg-white/5 hover:text-white/80"}`}
            >
              <Icon className="h-4 w-4 shrink-0" strokeWidth={2.25} />
              <span className="break-words">{config.shortLabel}</span>
              {position ? (
                <span className={`rounded-md px-1 py-0.5 text-[9px] font-black ${selected ? "bg-white/20 text-white" : "bg-white/[0.07] text-white/60"}`}>{position}º</span>
              ) : null}
            </button>
          );
        })}
      </div>

      <Leaderboard
        title={activeConfig.label}
        eyebrow={eyebrow}
        badge={badge}
        footer={positionCard}
        afterHero={
          <>
            {summaryTiles}
            {infoBox}
          </>
        }
        icon={<ActiveIcon className="h-4 w-4 text-purple-300" strokeWidth={2.25} />}
        unit={activeConfig.unit}
        ranking={rankings[active]}
        currentProfileId={currentProfileId}
        cutoff={cutoff}
      />
    </div>
  );
}
