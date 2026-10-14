import { ChevronRight, Search } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireOrganizer } from "@/lib/auth";
import { getRankingCounts } from "@/lib/rankings";
import { getSeasonRanking, ROLLING_INDEX_EVENT_COUNT } from "@/lib/seasonRanking";
import { Avatar } from "@/components/Avatar";
import { DeleteRankingAdjustmentButton } from "@/components/DeleteRankingAdjustmentButton";
import { deleteRankingAdjustment } from "./actions";
import { getActiveCommunity } from "@/lib/community";

const METRIC_LABELS: Record<string, string> = {
  attendance: "presença",
  mvp: "Jogador Destaque",
  wins: "vitória",
  losses: "derrota",
};

function formatDay(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export default async function AdminRankingPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const term = (q ?? "").trim().toLocaleLowerCase("pt-BR");
  const organizer = await requireOrganizer();
  const supabase = await createClient();
  const community = await getActiveCommunity(organizer);

  const [{ data: profiles }, counts, seasonScores, { data: adjustmentRows }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, avatar_url").eq("status", "approved").contains("communities", [community]).order("full_name"),
    getRankingCounts(supabase, community),
    getSeasonRanking(supabase, community),
    supabase
      .from("ranking_adjustments")
      .select("id, metric, delta, reason, events(date), profiles!ranking_adjustments_profile_id_profiles_id_fk(full_name)")
      .eq("community", community)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const positions = new Map(
    [...seasonScores.values()]
      .filter((score) => score.eligible)
      .sort((a, b) => b.averageIndex - a.averageIndex || b.totalWins - a.totalWins || b.totalAttendance - a.totalAttendance)
      .map((score, index) => [score.profileId, index + 1] as const),
  );

  const rows = (profiles ?? [])
    .filter((p) => !term || p.full_name.toLocaleLowerCase("pt-BR").includes(term))
    .map((p) => ({ profile: p, score: seasonScores.get(p.id), position: positions.get(p.id) }))
    .sort((a, b) => (a.position ?? 999) - (b.position ?? 999) || a.profile.full_name.localeCompare(b.profile.full_name, "pt-BR"));

  return (
    <div className="space-y-4">
      <header>
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-purple-300">Administração · {community === "sand" ? "Areia" : "Quadra"}</p>
        <h1 className="mt-0.5 text-2xl font-black text-white">Ajustar rankings</h1>
        <p className="mt-1 text-xs text-white/50">Escolha um jogador para corrigir presenças, vitórias, derrotas e destaques racha a racha. O Índice VPA muda na hora.</p>
      </header>

      <form method="get" className="flex gap-2">
        <label className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
          <input name="q" defaultValue={q ?? ""} placeholder="Buscar jogador" className="min-h-11 w-full rounded-xl border border-white/15 bg-white/[0.03] pl-9 pr-3 text-sm text-white placeholder:text-white/35 focus:border-purple-300/50 focus:outline-none" />
        </label>
        <button type="submit" className="min-h-11 rounded-xl bg-brand-purple px-4 text-sm font-semibold text-white hover:bg-brand-purple-dark">Buscar</button>
        {term && <Link href="/admin/ranking" className="flex min-h-11 items-center rounded-xl px-2 text-xs font-semibold text-white/55 hover:text-white">Limpar</Link>}
      </form>

      <ul aria-label="Jogadores" className="grid gap-1.5">
        {rows.map(({ profile, score, position }) => (
          <li key={profile.id}>
            <Link
              href={`/admin/ranking/${profile.id}`}
              className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-2.5 transition hover:bg-white/[0.07]"
            >
              <Avatar src={profile.avatar_url} name={profile.full_name} size="md" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-white">{profile.full_name}</span>
                <span className="block text-[11px] tabular-nums text-white/50">
                  {score ? `${score.totalWins}V · ${score.totalLosses}D · ` : ""}
                  {counts.attendance.get(profile.id) ?? 0} pres. · {counts.mvp.get(profile.id) ?? 0} dest.
                </span>
              </span>
              <span className="text-right">
                <b className="block text-base font-extrabold tabular-nums text-white">
                  {score ? (score.eligible ? score.averageIndex.toFixed(1).replace(".", ",") : "—") : "—"}
                </b>
                <small className="block text-[10.5px] text-white/50">
                  {position ? `#${position}` : score ? `${score.eventsPlayed}/${ROLLING_INDEX_EVENT_COUNT} rachas` : "sem Índice"}
                </small>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-white/30" />
            </Link>
          </li>
        ))}
        {!rows.length && <li className="px-1 py-3 text-sm text-white/60">Nenhum jogador encontrado.</li>}
      </ul>

      <section>
        <h2 className="px-0.5 text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-white/40">Últimos ajustes manuais</h2>
        <div className="mt-3 space-y-2">
          {(adjustmentRows ?? []).map((a) => {
            const p = a.profiles as unknown as { full_name: string } | null;
            const ev = a.events as unknown as { date: string } | null;
            return (
              <div key={a.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm">
                <span className="text-white/70">
                  {a.delta > 0 ? "+" : ""}
                  {a.delta} {METRIC_LABELS[a.metric] ?? a.metric} em <strong className="text-white">{p?.full_name}</strong>
                  {ev ? ` · racha ${formatDay(ev.date)}` : " · sem racha"}
                  {a.reason ? ` — ${a.reason}` : ""}
                </span>
                <DeleteRankingAdjustmentButton adjustmentId={a.id} action={deleteRankingAdjustment} />
              </div>
            );
          })}
          {!adjustmentRows?.length && <p className="text-sm text-white/60">Nenhum ajuste manual feito ainda.</p>}
        </div>
      </section>
    </div>
  );
}
