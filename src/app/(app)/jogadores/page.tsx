import { Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { getAllRatings, getRatingWeights } from "@/lib/ratings";
import { finalScoresForPlayer, overallScore } from "@/lib/scoring";
import { Avatar } from "@/components/Avatar";

export default async function JogadoresPage() {
  await requireProfile();
  const supabase = await createClient();

  const [{ data: players }, { selfByProfile, organizerByProfile }, weights] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, avatar_url, is_setter")
      .eq("status", "approved")
      .order("full_name"),
    getAllRatings(supabase),
    getRatingWeights(supabase),
  ]);

  const rows = (players ?? [])
    .map((p) => {
      const scores = finalScoresForPlayer(
        selfByProfile.get(p.id) ?? {},
        organizerByProfile.get(p.id) ?? {},
        weights.selfWeight,
        weights.organizerWeight,
      );
      return { ...p, overall: overallScore(scores) };
    })
    .sort((a, b) => b.overall - a.overall);

  return (
    <div>
      <h1 className="flex items-center gap-2 text-2xl font-bold text-brand-navy">
        <Users className="h-6 w-6 text-brand-purple" strokeWidth={2} />
        Jogadores
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        Nota geral combinando autoavaliação e nota dos organizadores.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((p) => (
          <div
            key={p.id}
            className="flex items-center gap-4 rounded-xl border border-gray-200 p-4"
          >
            <Avatar src={p.avatar_url} name={p.full_name} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-brand-navy">{p.full_name}</p>
              {p.is_setter && <p className="text-xs text-gray-500">🏐 Levantador(a)</p>}
              <div className="mt-1.5 h-1.5 w-full rounded-full bg-gray-100">
                <div
                  className="h-1.5 rounded-full bg-brand-purple"
                  style={{ width: `${Math.min(100, (p.overall / 5) * 100)}%` }}
                />
              </div>
            </div>
            <span className="shrink-0 text-lg font-semibold text-brand-purple">
              {p.overall.toFixed(1)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
