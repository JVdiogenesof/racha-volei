import { createClient } from "@/lib/supabase/server";
import { requireOrganizer } from "@/lib/auth";
import { getRankingCounts } from "@/lib/rankings";
import { RankingAdjustControl } from "@/components/RankingAdjustControl";
import { DeleteRankingAdjustmentButton } from "@/components/DeleteRankingAdjustmentButton";
import { adjustRanking, deleteRankingAdjustment } from "./actions";

const METRIC_LABELS: Record<string, string> = {
  attendance: "presença",
  mvp: "Jogador Destaque",
  wins: "vitória",
};

export default async function AdminRankingPage() {
  await requireOrganizer();
  const supabase = await createClient();

  const [{ data: profiles }, counts, { data: adjustmentRows }] = await Promise.all([
    supabase.from("profiles").select("id, full_name").eq("status", "approved").order("full_name"),
    getRankingCounts(supabase),
    supabase
      .from("ranking_adjustments")
      .select("id, metric, delta, reason, profiles!ranking_adjustments_profile_id_profiles_id_fk(full_name)")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Editar rankings</h1>
        <p className="mt-1 text-sm text-white/60">
          Ajuste manualmente presenças, vezes destaque e vitórias de qualquer jogador pra corrigir algum problema.
        </p>
      </div>

      <div className="rounded-xl border border-white/10">
          <div aria-hidden="true" className="hidden grid-cols-4 gap-3 border-b border-white/10 px-4 py-2.5 text-xs font-semibold text-white/60 sm:grid">
            <span>Jogador</span><span>Presenças</span><span>Destaques</span><span>Vitórias</span>
          </div>
          <ul aria-label="Ajustes de ranking por jogador" className="divide-y divide-white/10">
            {(profiles ?? []).map((p) => (
              <li key={p.id} className="grid min-w-0 gap-3 px-4 py-4 text-sm sm:grid-cols-4 sm:items-center">
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
        <h2 className="font-semibold text-white">Últimos ajustes manuais</h2>
        <div className="mt-3 space-y-2">
          {(adjustmentRows ?? []).map((a) => {
            const p = a.profiles as unknown as { full_name: string } | null;
            return (
              <div
                key={a.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-white/10 px-3 py-2 text-sm"
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
