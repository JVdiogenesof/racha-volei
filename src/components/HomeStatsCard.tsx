import { Avatar } from "./Avatar";
import { GoldIcon, RankBadge } from "./VpaStatIcons";
import type { HomeStats, Insight } from "@/lib/homeInsights";

function InsightCard({ insight }: { insight: Insight }) {
  return (
    <div className="w-[84%] shrink-0 snap-start rounded-2xl border border-white/10 bg-white/[0.06] p-2.5 sm:w-[46%]">
      <p className="flex items-center gap-2 text-[10.5px] font-extrabold uppercase tracking-[0.1em] text-white/60">
        <GoldIcon name={insight.id} />
        <span className="min-w-0 truncate">{insight.title}</span>
      </p>
      <ul className="mt-2 space-y-1.5">
        {insight.kind === "list"
          ? insight.rows.map((row, index) => (
              <li key={row.id} className="flex items-center gap-2">
                <RankBadge position={(index + 1) as 1 | 2 | 3} />
                <Avatar src={row.avatarUrl} name={row.name} size="sm" />
                <p className="min-w-0 flex-1 truncate text-[13px] font-bold text-white">{row.name}</p>
                <p className="text-[13px] font-black text-amber-200">
                  {row.value}
                  <span className="ml-0.5 text-[9px] font-semibold text-white/45">{insight.unit}</span>
                </p>
              </li>
            ))
          : insight.rows.map((row, index) => (
              <li key={`${row.a.id}-${row.b.id}`} className="flex items-center gap-2">
                <RankBadge position={(index + 1) as 1 | 2 | 3} />
                <div className="flex -space-x-2">
                  <Avatar src={row.a.avatarUrl} name={row.a.name} size="sm" />
                  <Avatar src={row.b.avatarUrl} name={row.b.name} size="sm" />
                </div>
                <p className="min-w-0 flex-1 truncate text-[12.5px] font-bold text-white">
                  {row.a.name} <span className="font-medium text-amber-300/80">{insight.sign}</span> {row.b.name}
                </p>
                <p className="text-[13px] font-black text-amber-200">
                  {row.value}
                  <span className="ml-0.5 text-[9px] font-semibold text-white/45">{insight.unit}</span>
                </p>
              </li>
            ))}
      </ul>
    </div>
  );
}

export function HomeStatsCard({ stats }: { stats: HomeStats }) {
  const mine = stats.myAttendance;
  const totals = [
    { icon: "jogos", value: stats.finishedRachas, label: "rachas" },
    { icon: "jogadores", value: stats.activePlayers, label: "jogadores" },
    { icon: "presencas", value: stats.totalPresences, label: "presenças" },
  ];

  return (
    <section className="rounded-[22px] border border-white/10 bg-gradient-to-br from-[#2a1666] to-[#150b36] p-3 shadow-xl shadow-purple-950/30">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[14px] font-extrabold text-white">VPA em números</h2>
        <div className="flex items-center gap-2.5">
          {totals.map((item) => (
            <span key={item.label} className="flex items-center gap-1 text-[11px] text-white/60">
              <GoldIcon name={item.icon} />
              <b className="font-black text-white">{item.value}</b>
              <span className="hidden min-[400px]:inline">{item.label}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="no-scrollbar -mx-3 mt-2.5 flex snap-x snap-mandatory gap-2 overflow-x-auto px-3 pb-0.5">
        {stats.insights.map((insight) => (
          <InsightCard key={insight.id} insight={insight} />
        ))}
      </div>

      {mine && (
        <p className="mt-2.5 flex items-center gap-2 rounded-xl border border-fuchsia-300/30 bg-gradient-to-r from-fuchsia-500/20 to-amber-400/10 px-2.5 py-1.5 text-[11.5px] text-white/85">
          <GoldIcon name={mine.position === 1 ? "duplas-vitorias" : "subiu"} />
          <span className="min-w-0">
            {mine.position === 1 ? (
              <><b className="font-extrabold text-white">Você é quem mais joga!</b> Segura a liderança.</>
            ) : (
              <><b className="font-extrabold text-white">Você é o {mine.position}º em presença.</b> Faltam {mine.toNext} {mine.toNext === 1 ? "racha" : "rachas"} pro {mine.position - 1}º.</>
            )}
          </span>
        </p>
      )}
    </section>
  );
}
