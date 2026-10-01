import { Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { getAllRatings, getRatingWeights } from "@/lib/ratings";
import { finalScoresForPlayer, overallScore } from "@/lib/scoring";
import { getAttendanceStreaks } from "@/lib/streak";
import { getRankingCounts } from "@/lib/rankings";
import { getFeaturedAchievements, getPlayerAchievements } from "@/lib/achievements";
import { PlayerSearch } from "@/components/PlayerSearch";
import { getActiveCommunity } from "@/lib/community";

export default async function JogadoresPage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const community = await getActiveCommunity(profile);

  const [{ data: players }, { selfByProfile, organizerByProfile }, weights, streaks, rankingCounts] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, avatar_url, is_setter, nickname_badge")
      .eq("status", "approved")
      .contains("communities", [community])
      .order("full_name"),
    getAllRatings(supabase),
    getRatingWeights(supabase),
    getAttendanceStreaks(supabase, community),
    getRankingCounts(supabase, community),
  ]);

  const rows = (players ?? [])
    .map((p) => {
      const scores = finalScoresForPlayer(
        selfByProfile.get(p.id) ?? {},
        organizerByProfile.get(p.id) ?? {},
        weights.selfWeight,
        weights.organizerWeight,
      );
      const achievementStats = {
        attendance: rankingCounts.attendance.get(p.id) ?? 0,
        wins: rankingCounts.wins.get(p.id) ?? 0,
        mvp: rankingCounts.mvp.get(p.id) ?? 0,
        streak: streaks.get(p.id) ?? 0,
        isSetter: p.is_setter,
      };
      return {
        ...p,
        overall: overallScore(scores),
        performance: rankingCounts.performance.get(p.id) ?? null,
        streak: achievementStats.streak,
        achievements: getFeaturedAchievements(achievementStats),
        achievementCount: getPlayerAchievements(achievementStats).filter((achievement) => achievement.unlocked).length,
      };
    })
    .sort((a, b) => b.overall - a.overall);

  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-purple-300/15 bg-purple-300/10">
          <Users className="h-5 w-5 text-purple-300" strokeWidth={2} />
        </span>
        <div>
          <h1 className="text-2xl font-black text-white">Jogadores · {community === "sand" ? "Areia" : "Quadra"}</h1>
          <p className="text-sm text-white/50">Toque em um jogador para ver o perfil completo.</p>
        </div>
      </div>

      <PlayerSearch players={rows} />
    </div>
  );
}
