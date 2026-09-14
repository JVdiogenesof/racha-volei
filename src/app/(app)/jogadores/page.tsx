import { Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { getAllRatings, getRatingWeights } from "@/lib/ratings";
import { finalScoresForPlayer, overallScore } from "@/lib/scoring";
import { getAttendanceStreaks } from "@/lib/streak";
import { PlayerSearch } from "@/components/PlayerSearch";

export default async function JogadoresPage() {
  await requireProfile();
  const supabase = await createClient();

  const [{ data: players }, { selfByProfile, organizerByProfile }, weights, streaks] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, avatar_url, is_setter, nickname_badge")
      .eq("status", "approved")
      .order("full_name"),
    getAllRatings(supabase),
    getRatingWeights(supabase),
    getAttendanceStreaks(supabase),
  ]);

  const rows = (players ?? [])
    .map((p) => {
      const scores = finalScoresForPlayer(
        selfByProfile.get(p.id) ?? {},
        organizerByProfile.get(p.id) ?? {},
        weights.selfWeight,
        weights.organizerWeight,
      );
      return { ...p, overall: overallScore(scores), streak: streaks.get(p.id) };
    })
    .sort((a, b) => b.overall - a.overall);

  return (
    <div>
      <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
        <Users className="h-6 w-6 text-purple-300" strokeWidth={2} />
        Jogadores
      </h1>
      <p className="mt-1 text-sm text-white/60">
        Nota geral combinando autoavaliação e nota dos organizadores.
      </p>

      <PlayerSearch players={rows} />
    </div>
  );
}
