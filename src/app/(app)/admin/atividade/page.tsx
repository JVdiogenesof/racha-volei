import Link from "next/link";
import { CalendarClock, CircleAlert, Clock3, TriangleAlert, UserMinus, UsersRound } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireOrganizer } from "@/lib/auth";
import { getActiveCommunity } from "@/lib/community";
import { Avatar } from "@/components/Avatar";
import { getAbsenceStreaks, ATTENDANCE_ALERT_THRESHOLD, ATTENDANCE_REMOVE_THRESHOLD } from "@/lib/attendancePolicy";

type PageSearchParams = Promise<{ view?: string; q?: string }>;

function daysSince(date: string | null) {
  if (!date) return null;
  const start = new Date(`${date}T12:00:00`).getTime();
  return Math.max(0, Math.floor((Date.now() - start) / 86_400_000));
}

function dateLabel(date: string | null) {
  return date ? new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR") : "Nunca participou";
}

export default async function AdminAtividadePage({ searchParams }: { searchParams: PageSearchParams }) {
  const { view = "all", q = "" } = await searchParams;
  const organizer = await requireOrganizer();
  const supabase = await createClient();
  const community = await getActiveCommunity(organizer);

  const [{ data: players }, { data: finishedEvents }, absenceStreaks] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, avatar_url, created_at")
      .eq("status", "approved")
      .eq("is_organizer", false)
      .contains("communities", [community])
      .order("full_name"),
    supabase
      .from("events")
      .select("id, date")
      .eq("community", community)
      .eq("status", "finished")
      .order("date", { ascending: false }),
    // Mesmo cálculo que a remoção automática usa, pra lista e enforcement
    // nunca divergirem.
    getAbsenceStreaks(supabase, community),
  ]);

  const eventIds = (finishedEvents ?? []).map((event) => event.id);
  const { data: attendanceRows } = eventIds.length
    ? await supabase
      .from("attendance")
      .select("profile_id, event_id")
      .eq("status", "confirmed")
      .in("event_id", eventIds)
    : { data: [] as { profile_id: string; event_id: string }[] };

  const eventDateById = new Map((finishedEvents ?? []).map((event) => [event.id, event.date]));
  const activity = new Map<string, { count: number; lastDate: string | null }>();
  for (const row of attendanceRows ?? []) {
    const prior = activity.get(row.profile_id) ?? { count: 0, lastDate: null };
    const eventDate = eventDateById.get(row.event_id) ?? null;
    activity.set(row.profile_id, {
      count: prior.count + 1,
      lastDate: !prior.lastDate || (eventDate && eventDate > prior.lastDate) ? eventDate : prior.lastDate,
    });
  }

  const normalizedQuery = q.trim().toLocaleLowerCase("pt-BR");
  const rows = (players ?? [])
    .map((player) => {
      const summary = activity.get(player.id) ?? { count: 0, lastDate: null };
      return { ...player, ...summary, daysAway: daysSince(summary.lastDate), streak: absenceStreaks.get(player.id) ?? 0 };
    })
    .filter((player) => !normalizedQuery || player.full_name.toLocaleLowerCase("pt-BR").includes(normalizedQuery))
    .filter((player) => view === "risco" ? player.streak >= ATTENDANCE_ALERT_THRESHOLD : view === "never" ? player.count === 0 : view === "60" ? (player.daysAway ?? Number.POSITIVE_INFINITY) >= 60 : view === "120" ? (player.daysAway ?? Number.POSITIVE_INFINITY) >= 120 : true)
    .sort((a, b) => {
      if (view === "risco" && b.streak !== a.streak) return b.streak - a.streak;
      if (a.count === 0 && b.count !== 0) return -1;
      if (b.count === 0 && a.count !== 0) return 1;
      return (b.daysAway ?? Number.POSITIVE_INFINITY) - (a.daysAway ?? Number.POSITIVE_INFINITY) || a.count - b.count || a.full_name.localeCompare(b.full_name, "pt-BR");
    });

  const neverCount = (players ?? []).filter((player) => !activity.has(player.id)).length;
  const away60Count = (players ?? []).filter((player) => {
    const lastDate = activity.get(player.id)?.lastDate ?? null;
    return (daysSince(lastDate) ?? Number.POSITIVE_INFINITY) >= 60;
  }).length;
  const activeCount = (players ?? []).length - away60Count;
  const atRiskCount = (players ?? []).filter((player) => (absenceStreaks.get(player.id) ?? 0) >= ATTENDANCE_ALERT_THRESHOLD).length;

  const chip = (href: string, label: string, active: boolean) => (
    <Link href={href} className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${active ? "bg-brand-purple text-white" : "border border-white/10 bg-white/[0.035] text-white/55 hover:bg-white/10 hover:text-white"}`}>{label}</Link>
  );

  return (
    <div className="space-y-4">
      <header>
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-purple-300">Administração · {community === "sand" ? "Areia" : "Quadra"}</p>
        <h1 className="mt-0.5 text-2xl font-black text-white">Atividade dos jogadores</h1>
        <p className="mt-1 text-sm text-white/55">Presenças em rachas encerrados. Use como apoio antes de remover alguém.</p>
      </header>

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat icon={TriangleAlert} label="Perto de sair" value={atRiskCount} tone="text-red-200" />
        <Stat icon={UsersRound} label="Ativos" value={activeCount} tone="text-emerald-200" />
        <Stat icon={CircleAlert} label="60+ dias" value={away60Count} tone="text-amber-200" />
        <Stat icon={UserMinus} label="Nunca foram" value={neverCount} tone="text-rose-200" />
      </section>

      <form action="/admin/atividade" method="get" className="flex gap-2">
        {view !== "all" && <input type="hidden" name="view" value={view} />}
        <input name="q" defaultValue={q} placeholder="Buscar jogador" className="min-h-10 min-w-0 flex-1 rounded-xl border border-white/12 bg-white/[0.04] px-3 text-sm text-white placeholder:text-white/35" />
        <button className="min-h-10 rounded-xl border border-white/15 px-3 text-sm font-semibold text-white/80 hover:bg-white/5">Buscar</button>
      </form>

      <nav className="no-scrollbar flex gap-2 overflow-x-auto pb-0.5">
        {chip("/admin/atividade?view=risco", `Perto de sair · ${atRiskCount}`, view === "risco")}
        {chip("/admin/atividade", `Todos · ${players?.length ?? 0}`, view === "all")}
        {chip("/admin/atividade?view=never", `Nunca foram · ${neverCount}`, view === "never")}
        {chip("/admin/atividade?view=60", `60+ dias · ${away60Count}`, view === "60")}
        {chip("/admin/atividade?view=120", "120+ dias", view === "120")}
      </nav>

      <section className="space-y-2">
        {rows.length ? rows.map((player) => {
          const inactive = player.count === 0 || (player.daysAway ?? 0) >= 60;
          const atRisk = player.streak >= ATTENDANCE_ALERT_THRESHOLD;
          const remaining = ATTENDANCE_REMOVE_THRESHOLD - player.streak;
          const lastDetail = player.count === 0
            ? `Cadastro em ${new Date(player.created_at).toLocaleDateString("pt-BR")}`
            : `${player.daysAway === 0 ? "Foi no último racha" : `${player.daysAway} dias sem ir`} · última vez ${dateLabel(player.lastDate)}`;
          return (
            <article key={player.id} className={`flex min-w-0 items-center gap-3 rounded-2xl border p-3 ${atRisk ? "border-red-400/35 bg-red-500/[0.08]" : inactive ? "border-amber-300/18 bg-amber-400/[0.055]" : "border-white/10 bg-white/[0.03]"}`}>
              <Avatar src={player.avatar_url} name={player.full_name} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-white">{player.full_name}</p>
                <p className="mt-0.5 truncate text-xs text-white/50">{lastDetail}</p>
                {atRisk && (
                  <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-bold text-red-100">
                    <TriangleAlert className="h-3 w-3" strokeWidth={2.5} />
                    {player.streak}/{ATTENDANCE_REMOVE_THRESHOLD} faltas seguidas · sai em {remaining === 1 ? "1 racha" : `${remaining} rachas`}
                  </p>
                )}
              </div>
              <div className="shrink-0 text-right">
                <strong className={`block text-base font-black ${player.count === 0 ? "text-rose-200" : "text-white"}`}>{player.count}</strong>
                <span className="block text-[9px] font-bold uppercase tracking-wide text-white/40">presenças</span>
              </div>
            </article>
          );
        }) : <p className="rounded-2xl border border-white/10 px-4 py-8 text-center text-sm text-white/45">Nenhum jogador neste filtro.</p>}
      </section>

      <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-xs text-white/45"><CalendarClock className="h-4 w-4 shrink-0 text-purple-200" />A contagem considera somente rachas finalizados, para não punir quem ainda está inscrito no próximo.</div>
      <Link href="/admin/jogadores" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/15 px-3 text-sm font-semibold text-white/75 hover:bg-white/5"><Clock3 className="h-4 w-4" />Gerenciar jogadores e acessos</Link>
    </div>
  );
}

function Stat({ icon: Icon, label, value, tone }: { icon: typeof UsersRound; label: string; value: number; tone: string }) {
  return <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.035] px-2.5 py-3 text-center"><Icon className={`mx-auto h-4 w-4 ${tone}`} /><strong className="mt-1 block text-lg font-black text-white">{value}</strong><span className="block truncate text-[9px] font-bold uppercase tracking-wide text-white/40">{label}</span></div>;
}
