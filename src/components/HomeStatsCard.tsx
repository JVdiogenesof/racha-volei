import { Avatar } from "./Avatar";
import type { HomeStats, Insight } from "@/lib/homeInsights";

const MEDALS = ["🥇", "🥈", "🥉"];

function InsightBlock({ insight }: { insight: Insight }) {
  return (
    <div>
      <p className="mb-2 mt-4 text-[10px] font-extrabold uppercase tracking-[0.12em] text-white/50">
        <span aria-hidden>{insight.emoji}</span> {insight.title}
      </p>
      {insight.kind === "list" ? (
        <ul className="space-y-2">
          {insight.rows.map((row, index) => {
            const top = insight.rows[0].value || 1;
            return (
              <li key={row.id} className="flex items-center gap-2.5">
                <span className="w-[18px] text-center text-[15px]" aria-hidden>{MEDALS[index]}</span>
                <Avatar src={row.avatarUrl} name={row.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-bold text-white">{row.name}</p>
                  <div className="mt-1 h-[5px] overflow-hidden rounded-full bg-white/10">
                    <div
                      className={`h-full rounded-full ${index === 0 ? "bg-gradient-to-r from-amber-500 to-amber-200" : "bg-gradient-to-r from-purple-400 to-fuchsia-300"}`}
                      style={{ width: `${Math.max(8, Math.round((row.value / top) * 100))}%` }}
                    />
                  </div>
                </div>
                <p className="text-[13px] font-black text-white">
                  {row.value}
                  <span className="ml-0.5 text-[9px] font-semibold text-white/50">{insight.unit}</span>
                </p>
              </li>
            );
          })}
        </ul>
      ) : (
        <ul className="space-y-2">
          {insight.rows.map((row, index) => (
            <li key={`${row.a.id}-${row.b.id}`} className="flex items-center gap-2.5 rounded-2xl bg-white/[0.06] px-2.5 py-2">
              <span className="w-[18px] text-center text-[15px]" aria-hidden>{MEDALS[index]}</span>
              <div className="flex -space-x-2">
                <Avatar src={row.a.avatarUrl} name={row.a.name} size="sm" />
                <Avatar src={row.b.avatarUrl} name={row.b.name} size="sm" />
              </div>
              <p className="min-w-0 flex-1 truncate text-[13px] font-bold text-white">
                {row.a.name} <span className="font-medium text-white/40">{insight.id === "rivais" ? "×" : "&"}</span> {row.b.name}
              </p>
              <p className="text-[13px] font-black text-white">
                {row.value}
                <span className="ml-0.5 text-[9px] font-semibold text-white/50">{insight.unit}</span>
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function HomeStatsCard({ stats }: { stats: HomeStats }) {
  const tiles = [
    { emoji: "🏐", value: stats.finishedRachas, label: "rachas jogados" },
    { emoji: "👥", value: stats.activePlayers, label: "jogadores ativos" },
    { emoji: "✅", value: stats.totalPresences, label: "presenças" },
  ];
  const mine = stats.myAttendance;

  return (
    <section className="rounded-[22px] border border-white/10 bg-gradient-to-br from-[#2a1666] to-[#150b36] p-3.5 shadow-xl shadow-purple-950/30">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[15px] font-extrabold text-white">VPA em números</h2>
        <span className="text-[10px] text-white/45">muda todo dia</span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-2xl bg-white/[0.07] px-2 py-2.5 text-center">
            <span className="block text-xl" aria-hidden>{tile.emoji}</span>
            <b className="mt-0.5 block text-[22px] font-black leading-tight text-white">{tile.value}</b>
            <span className="text-[9.5px] font-semibold text-white/55">{tile.label}</span>
          </div>
        ))}
      </div>

      {stats.insights.map((insight) => (
        <InsightBlock key={insight.id} insight={insight} />
      ))}

      {mine && (
        <div className="mt-4 flex items-center gap-2.5 rounded-2xl border border-fuchsia-300/35 bg-gradient-to-r from-fuchsia-500/25 to-amber-400/15 px-3 py-2.5">
          <span className="text-2xl" aria-hidden>{mine.position === 1 ? "👑" : "🚀"}</span>
          <div>
            <p className="text-[13px] font-extrabold text-white">
              {mine.position === 1 ? "Você é quem mais joga no VPA!" : `Você está em ${mine.position}º em presença`}
            </p>
            <p className="text-[11px] text-white/70">
              {mine.position === 1
                ? `${mine.count} rachas jogados. Segura a liderança!`
                : `Mais ${mine.toNext} ${mine.toNext === 1 ? "racha" : "rachas"} e você alcança o ${mine.position - 1}º lugar`}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
