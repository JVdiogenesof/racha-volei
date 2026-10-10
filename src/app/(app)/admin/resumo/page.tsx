import { Award, BarChart3, CalendarCheck, CalendarDays, Crown, LockKeyhole, Percent, Swords, Trophy, Users2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireOrganizer } from "@/lib/auth";
import { COMMUNITY_INFO, getActiveCommunity } from "@/lib/community";
import { currentMonthKey, formatMonthLabel, getMonthlyReport, normalizeMonthKey, type MonthlyReportPlayer } from "@/lib/monthlyReport";
import { MonthlyReportArts } from "@/components/MonthlyReportArts";

const RANKING_CONFIG = [
  { id: "performance" as const, label: "Aproveitamento", icon: Percent, value: (player: MonthlyReportPlayer) => player.percentage === null ? "—" : `${player.percentage}%`, detail: (player: MonthlyReportPlayer) => `${player.performanceWins}V · ${player.losses}D` },
  { id: "wins" as const, label: "Vitórias", icon: Crown, value: (player: MonthlyReportPlayer) => String(player.wins), detail: (player: MonthlyReportPlayer) => `${player.matches} confrontos` },
  { id: "mvp" as const, label: "Destaques", icon: Trophy, value: (player: MonthlyReportPlayer) => String(player.mvp), detail: () => "no mês" },
  { id: "attendance" as const, label: "Presenças", icon: CalendarCheck, value: (player: MonthlyReportPlayer) => String(player.attendance), detail: () => "rachas" },
];

export default async function AdminResumoPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const profile = await requireOrganizer();
  const supabase = await createClient();
  const community = await getActiveCommunity(profile);
  const monthKey = normalizeMonthKey((await searchParams).month);

  const { data: monthEvents } = await supabase.from("events").select("date").eq("community", community).order("date", { ascending: false });
  const availableMonths = [...new Set([currentMonthKey(), ...(monthEvents ?? []).map((event) => event.date.slice(0, 7))])].sort().reverse();
  const report = await getMonthlyReport(supabase, community, monthKey);
  const remaining = Math.max(0, report.requiredEvents - report.finishedEvents.length);
  const progress = Math.min(100, (report.finishedEvents.length / report.requiredEvents) * 100);

  return (
    <div className="min-w-0">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-white"><BarChart3 className="h-6 w-6 text-purple-300" /> Análise mensal · {COMMUNITY_INFO[community].shortLabel}</h1>
          <p className="mt-1 text-sm text-white/60">Todos os rankings do mês, dados individuais e artes prontas para publicar.</p>
        </div>
        <form className="flex items-center gap-2" action="/admin/resumo">
          <label htmlFor="month" className="text-xs font-bold uppercase tracking-wide text-white/45">Mês</label>
          <select id="month" name="month" defaultValue={report.monthKey} className="min-h-11 rounded-xl border border-white/15 bg-[#171039] px-3 text-sm font-semibold capitalize text-white transition focus:border-purple-300/50 focus:outline-none">
            {availableMonths.map((key) => <option key={key} value={key}>{formatMonthLabel(key)}</option>)}
          </select>
          <button type="submit" className="min-h-11 rounded-xl bg-white/10 px-3 text-sm font-bold text-white hover:bg-white/15">Ver</button>
        </form>
      </div>

      <section className={`mt-6 overflow-hidden rounded-2xl border p-5 ${report.unlocked ? "border-emerald-300/20 bg-emerald-400/[0.06]" : "border-amber-300/20 bg-amber-400/[0.06]"}`}>
        <div className="flex items-start gap-3">
          <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${report.unlocked ? "bg-emerald-400/15 text-emerald-200" : "bg-amber-300/15 text-amber-200"}`}>
            {report.unlocked ? <Award className="h-5 w-5" /> : <LockKeyhole className="h-5 w-5" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-base font-black capitalize text-white">{report.monthLabel}</p>
            <p className="mt-1 text-sm leading-5 text-white/60">
              {report.unlocked ? `Relatório liberado com ${report.finishedEvents.length} rachas encerrados.` : remaining === 1 ? "Falta encerrar mais 1 racha para liberar a análise e as artes." : `Faltam encerrar mais ${remaining} rachas para liberar a análise e as artes.`}
            </p>
          </div>
          <span className="shrink-0 text-xl font-black text-white">{report.finishedEvents.length}/{report.requiredEvents}</span>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-black/20"><div className={`h-full rounded-full transition-all ${report.unlocked ? "bg-emerald-400" : "bg-amber-300"}`} style={{ width: `${progress}%` }} /></div>
        {report.finishedEvents.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{report.finishedEvents.map((event, index) => <span key={event.id} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-bold text-white/60">Racha {index + 1} · {new Date(`${event.date}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</span>)}</div>}
      </section>

      {!report.unlocked ? (
        <section className="mt-5 rounded-2xl border border-white/10 bg-white/[0.025] p-6 text-center">
          <CalendarDays className="mx-auto h-8 w-8 text-white/25" />
          <p className="mt-3 font-bold text-white">O resumo permanece fechado até o quarto racha.</p>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-white/50">Assim os rankings mensais só são divulgados quando o ciclo estiver completo. Ao encerrar o quarto racha, esta tela libera automaticamente todos os dados e as cinco artes.</p>
        </section>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard icon={CalendarDays} label="Rachas encerrados" value={report.finishedEvents.length} />
            <StatCard icon={Users2} label="Jogadores no mês" value={report.players.length} />
            <StatCard icon={Swords} label="Resultados registrados" value={report.totalMatches} />
            <StatCard icon={CalendarCheck} label="Média de presença" value={report.averageAttendance.toFixed(1)} />
          </div>

          <section className="mt-6 grid gap-3 md:grid-cols-2">
            {RANKING_CONFIG.map((ranking) => {
              const Icon = ranking.icon;
              const leaders = report.rankings[ranking.id].slice(0, 3);
              return (
                <article key={ranking.id} className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                  <div className="flex items-center gap-2"><Icon className="h-5 w-5 text-purple-300" /><h2 className="font-black text-white">{ranking.label}</h2></div>
                  <ol className="mt-4 space-y-2">
                    {leaders.map((player, index) => <li key={player.profileId} className="flex items-center gap-3 rounded-xl bg-white/[0.04] px-3 py-2.5"><span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-black ${index === 0 ? "bg-amber-300 text-amber-950" : "bg-white/10 text-white/60"}`}>{index + 1}</span><span className="min-w-0 flex-1 truncate text-sm font-semibold text-white">{player.fullName}</span><span className="text-right"><strong className="block text-sm text-purple-200">{ranking.value(player)}</strong><small className="block text-[9px] text-white/35">{ranking.detail(player)}</small></span></li>)}
                  </ol>
                </article>
              );
            })}
          </section>

          <section className="mt-6 overflow-hidden rounded-2xl border border-white/10">
            <div className="border-b border-white/10 bg-white/[0.04] p-4"><h2 className="font-black text-white">Dados de todos os jogadores</h2><p className="mt-1 text-xs text-white/45">Resultados registrados somente nos rachas encerrados deste mês.</p></div>
            <div className="space-y-2 p-3 sm:hidden">
              {report.players.map((player) => <article key={player.profileId} className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3"><p className="truncate text-sm font-bold text-white">{player.fullName}</p><div className="mt-3 grid grid-cols-3 gap-2 text-center"><PlayerStat label="Presenças" value={player.attendance} /><PlayerStat label="Vitórias" value={player.wins} accent="text-emerald-300" /><PlayerStat label="Derrotas" value={player.losses} accent="text-rose-300" /><PlayerStat label="Jogos" value={player.matches} /><PlayerStat label="Aproveit." value={player.percentage === null ? "—" : `${player.percentage}%`} accent="text-purple-200" /><PlayerStat label="Destaques" value={player.mvp} accent="text-amber-200" /></div></article>)}
            </div>
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-black/10 text-[10px] uppercase tracking-wide text-white/40"><tr><th className="px-4 py-3">Jogador</th><th className="px-3 py-3 text-center">Presenças</th><th className="px-3 py-3 text-center">Vitórias</th><th className="px-3 py-3 text-center">Derrotas</th><th className="px-3 py-3 text-center">Jogos</th><th className="px-3 py-3 text-center">Aproveit.</th><th className="px-3 py-3 text-center">Destaques</th></tr></thead>
                <tbody className="divide-y divide-white/[0.06]">{report.players.map((player) => <tr key={player.profileId} className="text-white/70"><td className="px-4 py-3 font-semibold text-white">{player.fullName}</td><td className="px-3 py-3 text-center">{player.attendance}</td><td className="px-3 py-3 text-center text-emerald-300">{player.wins}</td><td className="px-3 py-3 text-center text-rose-300">{player.losses}</td><td className="px-3 py-3 text-center">{player.matches}</td><td className="px-3 py-3 text-center font-bold text-purple-200">{player.percentage === null ? "—" : `${player.percentage}%`}</td><td className="px-3 py-3 text-center text-amber-200">{player.mvp}</td></tr>)}</tbody>
              </table>
            </div>
          </section>

          <MonthlyReportArts monthKey={report.monthKey} />
        </>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: typeof CalendarDays; label: string; value: string | number }) {
  return <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><Icon className="h-5 w-5 text-purple-300" /><p className="mt-3 text-2xl font-black text-white">{value}</p><p className="mt-1 text-xs text-white/45">{label}</p></div>;
}

function PlayerStat({ label, value, accent = "text-white" }: { label: string; value: string | number; accent?: string }) {
  return <span><strong className={`block text-sm ${accent}`}>{value}</strong><small className="block text-[9px] text-white/35">{label}</small></span>;
}
