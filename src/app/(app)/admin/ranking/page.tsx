import { Search } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireOrganizer } from "@/lib/auth";
import { getRankingCounts } from "@/lib/rankings";
import { RankingAdjustControl } from "@/components/RankingAdjustControl";
import { DeleteRankingAdjustmentButton } from "@/components/DeleteRankingAdjustmentButton";
import { adjustRanking, deleteRankingAdjustment } from "./actions";
import { getActiveCommunity } from "@/lib/community";

const METRIC_LABELS: Record<string, string> = {
  attendance: "presença",
  mvp: "Jogador Destaque",
  wins: "vitória",
};

export default async function AdminRankingPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const term = (q ?? "").trim().toLocaleLowerCase("pt-BR");
  const organizer = await requireOrganizer();
  const supabase = await createClient();
  const community = await getActiveCommunity(organizer);

  const [{ data: profiles }, counts, { data: adjustmentRows }] = await Promise.all([
    supabase.from("profiles").select("id, full_name").eq("status", "approved").contains("communities", [community]).order("full_name"),
    getRankingCounts(supabase, community),
    supabase
      .from("ranking_adjustments")
      .select("id, metric, delta, reason, profiles!ranking_adjustments_profile_id_profiles_id_fk(full_name)")
      .eq("community", community)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  return (
    <div className="space-y-4">
      <header>
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-purple-300">Administração · {community === "sand" ? "Areia" : "Quadra"}</p>
        <h1 className="mt-0.5 text-2xl font-black text-white">Ajustar rankings</h1>
        <p className="mt-1 text-xs text-white/50">Corrija presenças, destaques e vitórias de qualquer jogador. Cada ajuste fica registrado.</p>
      </header>

      <form method="get" className="flex gap-2">
        <label className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
          <input name="q" defaultValue={q ?? ""} placeholder="Buscar jogador" className="min-h-11 w-full rounded-xl border border-white/15 bg-white/[0.03] pl-9 pr-3 text-sm text-white placeholder:text-white/35 focus:border-purple-300/50 focus:outline-none" />
        </label>
        <button type="submit" className="min-h-11 rounded-xl bg-brand-purple px-4 text-sm font-semibold text-white hover:bg-brand-purple-dark">Buscar</button>
        {term && <Link href="/admin/ranking" className="flex min-h-11 items-center rounded-xl px-2 text-xs font-semibold text-white/55 hover:text-white">Limpar</Link>}
      </form>

      <div className="rounded-2xl border border-white/10 bg-white/[0.02]">
          <div aria-hidden="true" className="hidden grid-cols-4 gap-3 border-b border-white/10 px-4 py-2.5 text-xs font-semibold text-white/60 sm:grid">
            <span>Jogador</span><span>Presenças</span><span>Destaques</span><span>Vitórias</span>
          </div>
          <ul aria-label="Ajustes de ranking por jogador" className="divide-y divide-white/10">
            {(profiles ?? []).filter((p) => !term || p.full_name.toLocaleLowerCase("pt-BR").includes(term)).map((p) => (
              <li key={p.id} className="grid min-w-0 gap-2 px-3 py-3 sm:px-4 text-sm sm:grid-cols-4 sm:items-center">
                <p className="min-w-0 break-words font-medium text-white">{p.full_name}</p>
                <div className="flex items-center justify-between gap-2 sm:block" role="group" aria-label={`Presenças de ${p.full_name}`}>
                  <span className="text-xs text-white/60 sm:hidden">Presenças</span>
                  <RankingAdjustControl
                    profileId={p.id}
                    metric="attendance"
                    value={counts.attendance.get(p.id) ?? 0}
                    action={adjustRanking}
                  />
                </div>
                <div className="flex items-center justify-between gap-2 sm:block" role="group" aria-label={`Destaques de ${p.full_name}`}>
                  <span className="text-xs text-white/60 sm:hidden">Destaques</span>
                  <RankingAdjustControl
                    profileId={p.id}
                    metric="mvp"
                    value={counts.mvp.get(p.id) ?? 0}
                    action={adjustRanking}
                  />
                </div>
                <div className="flex items-center justify-between gap-2 sm:block" role="group" aria-label={`Vitórias de ${p.full_name}`}>
                  <span className="text-xs text-white/60 sm:hidden">Vitórias</span>
                  <RankingAdjustControl
                    profileId={p.id}
                    metric="wins"
                    value={counts.wins.get(p.id) ?? 0}
                    action={adjustRanking}
                  />
                </div>
              </li>
            ))}
            {!profiles?.length && (
              <li className="px-4 py-4 text-sm text-white/60">
                  Nenhum jogador aprovado ainda.
              </li>
            )}
          </ul>
      </div>

      <section>
        <h2 className="px-0.5 text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-white/40">Últimos ajustes manuais</h2>
        <div className="mt-3 space-y-2">
          {(adjustmentRows ?? []).map((a) => {
            const p = a.profiles as unknown as { full_name: string } | null;
            return (
              <div
                key={a.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm"
              >
                <span className="text-white/70">
                  {a.delta > 0 ? "+" : ""}
                  {a.delta} {METRIC_LABELS[a.metric] ?? a.metric} em{" "}
                  <strong className="text-white">{p?.full_name}</strong>
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
