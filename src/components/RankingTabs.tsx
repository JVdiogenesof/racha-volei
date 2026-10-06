"use client";

import { useState } from "react";
import { CalendarCheck, Crown, Percent, Trophy, type LucideIcon } from "lucide-react";
import { Leaderboard, type RankingEntry } from "./Leaderboard";

type RankingId = "performance" | "wins" | "mvp" | "attendance";

const CONFIG: Record<RankingId, { label: string; shortLabel: string; unit: string; description: string; icon: LucideIcon }> = {
  performance: { label: "Índice VPA", shortLabel: "Índice VPA", unit: "pontos", description: "Classificação justa: 70% do aproveitamento + 30% da presença em relação ao jogador mais assíduo. São necessários 3 rachas encerrados para entrar nas posições.", icon: Percent },
  wins: { label: "Mais vitórias", shortLabel: "Vitórias", unit: "vitórias", description: "Total de confrontos vencidos por cada jogador.", icon: Crown },
  mvp: { label: "Jogador Destaque", shortLabel: "Destaques", unit: "vezes", description: "Quantidade de vezes em que a pessoa foi eleita destaque do racha.", icon: Trophy },
  attendance: { label: "Mais presença", shortLabel: "Presenças", unit: "presenças", description: "Participações confirmadas em rachas que já foram encerrados.", icon: CalendarCheck },
};

export function RankingTabs({
  currentProfileId,
  rankings,
}: {
  currentProfileId: string;
  rankings: Record<RankingId, RankingEntry[]>;
}) {
  const [active, setActive] = useState<RankingId>("performance");
  const ids = Object.keys(CONFIG) as RankingId[];
  const activeConfig = CONFIG[active];
  const ActiveIcon = activeConfig.icon;

  function currentEntry(id: RankingId) {
    const ranking = rankings[id];
    const index = ranking.findIndex((entry) => entry.profileId === currentProfileId);
    const entry = index >= 0 ? ranking[index] : null;
    const position = entry && entry.ranked !== false
      ? ranking.filter((item) => item.ranked !== false).findIndex((item) => item.profileId === currentProfileId) + 1
      : null;
    return { entry, position };
  }

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {ids.map((id) => {
          const config = CONFIG[id];
          const Icon = config.icon;
          const mine = currentEntry(id);
          return (
            <button
              key={id}
              type="button"
              onClick={() => setActive(id)}
              className={`rounded-xl border p-3 text-left transition ${active === id ? "border-purple-300/35 bg-purple-400/15" : "border-white/10 bg-white/[0.025] hover:bg-white/5"}`}
            >
              <span className="flex items-center justify-between gap-2">
                <Icon className={`h-4 w-4 ${active === id ? "text-purple-200" : "text-white/35"}`} />
                <span className={`text-lg font-black ${mine.position ? "text-white" : "text-white/30"}`}>{mine.position ? `${mine.position}º` : "—"}</span>
              </span>
              <span className="mt-2 block text-[10px] font-bold uppercase tracking-wide text-white/40">Sua posição</span>
              <span className="block truncate text-xs font-semibold text-white/70">{config.shortLabel}</span>
            </button>
          );
        })}
      </section>

      <div className="no-scrollbar -mx-1 overflow-x-auto px-1">
        <div className="flex w-max min-w-full gap-1 rounded-2xl border border-white/10 bg-white/[0.025] p-1 sm:min-w-0">
          {ids.map((id) => {
            const config = CONFIG[id];
            const Icon = config.icon;
            const selected = active === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActive(id)}
                aria-pressed={selected}
                className={`flex min-h-10 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-semibold leading-none transition sm:flex-1 ${selected ? "bg-brand-purple text-white shadow-md shadow-purple-950/30" : "text-white/45 hover:bg-white/5 hover:text-white/75"}`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {config.shortLabel}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-purple-300/15 bg-purple-400/[0.06] px-3.5 py-3">
        <ActiveIcon className="mt-0.5 h-4 w-4 shrink-0 text-purple-200" />
        <p className="text-xs leading-relaxed text-white/55">{activeConfig.description}</p>
      </div>

      <Leaderboard
        title={activeConfig.label}
        icon={<ActiveIcon className="h-5 w-5 text-purple-300" strokeWidth={2} />}
        unit={activeConfig.unit}
        ranking={rankings[active]}
        currentProfileId={currentProfileId}
      />
    </div>
  );
}
