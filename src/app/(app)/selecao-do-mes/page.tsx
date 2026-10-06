import { CalendarDays, Crown, LockKeyhole, Sparkles, Trophy, UsersRound } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { COMMUNITY_INFO, getActiveCommunity } from "@/lib/community";
import { currentMonthKey, formatMonthLabel, getMonthlyReport, normalizeMonthKey } from "@/lib/monthlyReport";
import { getMonthlySelection } from "@/lib/monthlySelection";
import { MonthlySelectionCourt } from "@/components/MonthlySelectionCourt";

export default async function MonthlySelectionPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const community = await getActiveCommunity(profile);
  const { data: eventRows } = await supabase
    .from("events")
    .select("date, status")
    .eq("community", community)
    .order("date", { ascending: false });

  const finishedCountByMonth = new Map<string, number>();
  for (const event of eventRows ?? []) {
    if (event.status !== "finished") continue;
    const key = event.date.slice(0, 7);
    finishedCountByMonth.set(key, (finishedCountByMonth.get(key) ?? 0) + 1);
  }
  const completedMonths = [...finishedCountByMonth.entries()]
    .filter(([, count]) => count >= 4)
    .map(([key]) => key)
    .sort()
    .reverse();
  const eventMonths = [...new Set((eventRows ?? []).map((event) => event.date.slice(0, 7)))];
  const requested = (await searchParams).month;
  const defaultMonth = completedMonths[0] ?? currentMonthKey();
  const monthKey = normalizeMonthKey(requested, defaultMonth);
  const report = await getMonthlyReport(supabase, community, monthKey);
  const selection = getMonthlySelection(report);
  const availableMonths = [...new Set([monthKey, currentMonthKey(), ...completedMonths, ...eventMonths])].sort().reverse();
  const remaining = Math.max(0, report.requiredEvents - report.finishedEvents.length);

  return (
    <div className="mx-auto min-w-0 max-w-4xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-purple-300"><Trophy className="h-4 w-4" /> Destaques VPA</p>
          <h1 className="mt-1 text-2xl font-black text-white">Seleção do Mês · {COMMUNITY_INFO[community].shortLabel}</h1>
          <p className="mt-1 max-w-xl text-sm leading-6 text-white/55">Um levantador e os cinco jogadores de maior destaque, escolhidos pelos resultados reais do mês.</p>
        </div>
        <form action="/selecao-do-mes" className="flex items-center gap-2">
          <label htmlFor="selection-month" className="sr-only">Escolher mês</label>
          <select id="selection-month" name="month" defaultValue={monthKey} className="min-h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-[#171039] px-3 text-sm font-semibold capitalize text-white sm:flex-none">
            {availableMonths.map((key) => <option key={key} value={key}>{formatMonthLabel(key)}</option>)}
          </select>
          <button type="submit" className="min-h-11 rounded-xl bg-purple-500 px-4 text-sm font-bold text-white transition hover:bg-purple-400 active:scale-95">Ver</button>
        </form>
      </div>

      {!report.unlocked ? (
        <section className="mt-6 overflow-hidden rounded-3xl border border-amber-300/20 bg-gradient-to-br from-amber-300/[0.09] to-white/[0.025] p-6 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-amber-300/10 text-amber-200"><LockKeyhole className="h-6 w-6" /></span>
          <h2 className="mt-4 text-lg font-black text-white">A seleção ainda está em formação</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/55">
            {remaining === 1 ? "Falta encerrar mais 1 racha deste mês." : `Faltam encerrar mais ${remaining} rachas deste mês.`} A quadra será liberada automaticamente ao completar quatro.
          </p>
          <div className="mx-auto mt-5 flex max-w-xs items-center gap-2">
            {[0, 1, 2, 3].map((index) => <span key={index} className={`h-2 flex-1 rounded-full ${index < report.finishedEvents.length ? "bg-amber-300" : "bg-white/10"}`} />)}
          </div>
          <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-white/35">{report.finishedEvents.length}/4 rachas encerrados</p>
        </section>
      ) : selection.complete ? (
        <div className="mt-6 space-y-4">
          <MonthlySelectionCourt selection={selection} community={community} monthLabel={report.monthLabel} />
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <InfoCard icon={Sparkles} label="Índice VPA" value="60%" />
            <InfoCard icon={Crown} label="Vitórias" value="20%" />
            <InfoCard icon={CalendarDays} label="Presença" value="10%" />
            <InfoCard icon={Trophy} label="Destaques" value="10%" />
          </section>
          <p className="text-center text-[10px] leading-relaxed text-white/35">A vaga de levantador é escolhida apenas entre os jogadores marcados como levantadores. Os outros cinco entram pela maior pontuação combinada do mês.</p>
        </div>
      ) : (
        <section className="mt-6 rounded-3xl border border-purple-300/15 bg-purple-400/[0.055] p-6 text-center">
          <UsersRound className="mx-auto h-8 w-8 text-purple-300" />
          <h2 className="mt-3 font-black text-white">Ainda não foi possível fechar os seis</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/50">O mês já foi liberado, mas precisa ter ao menos seis jogadores com presença e um deles marcado como levantador.</p>
        </section>
      )}
    </div>
  );
}

function InfoCard({ icon: Icon, label, value }: { icon: typeof Sparkles; label: string; value: string }) {
  return <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3 text-center"><Icon className="mx-auto h-4 w-4 text-purple-300" /><strong className="mt-2 block text-lg text-white">{value}</strong><span className="text-[10px] font-semibold uppercase tracking-wide text-white/40">{label}</span></div>;
}
