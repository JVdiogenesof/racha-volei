import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { getRankingCounts, PERFORMANCE_MIN_ATTENDANCE } from "@/lib/rankings";
import { type RankingEntry } from "@/components/Leaderboard";
import { RankingTabs } from "@/components/RankingTabs";
import { getActiveCommunity } from "@/lib/community";

export default async function RankingPage() {
  const currentProfile = await requireProfile();
  const supabase = await createClient();
  const community = await getActiveCommunity(currentProfile);

  const [{ data: profiles }, counts] = await Promise.all([
    supabase.from("profiles").select("id, full_name, avatar_url").eq("status", "approved").contains("communities", [community]),
    getRankingCounts(supabase, community),
  ]);

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  function buildRanking(rawCounts: Map<string, number>): RankingEntry[] {
    return [...rawCounts.entries()]
      .map(([profileId, count]) => {
        const profile = profileById.get(profileId);
        if (!profile) return null;
        return {
          profileId,
          count: Math.max(0, count),
          fullName: profile.full_name,
          avatarUrl: profile.avatar_url,
        };
      })
      .filter((entry): entry is RankingEntry => entry !== null)
      .sort((a, b) => b.count - a.count);
  }

  const attendanceRanking = buildRanking(counts.attendance);
  const mvpRanking = buildRanking(counts.mvp);
  const winsRanking = buildRanking(counts.wins);
  const performanceRanking: RankingEntry[] = [...counts.performance.entries()]
    .flatMap(([profileId, stats]) => {
      const profile = profileById.get(profileId);
      if (!profile || !stats.matches) return [];
      return [{
        profileId,
        count: stats.indexScore,
        fullName: profile.full_name,
        avatarUrl: profile.avatar_url,
        displayValue: stats.eligible ? `${stats.indexScore.toFixed(1)} pts` : "Em classificação",
        detail: stats.eligible
          ? `${stats.percentage}% · ${stats.wins}V · ${stats.losses}D · ${stats.attendance} pres.`
          : `${stats.attendance}/${PERFORMANCE_MIN_ATTENDANCE} rachas · ${stats.percentage}% atual`,
        ranked: stats.eligible,
      }];
    })
    .sort(
      (a, b) =>
        Number(b.ranked !== false) - Number(a.ranked !== false) ||
        b.count - a.count ||
        (counts.performance.get(b.profileId)?.percentage ?? 0) - (counts.performance.get(a.profileId)?.percentage ?? 0) ||
        (counts.performance.get(b.profileId)?.wins ?? 0) - (counts.performance.get(a.profileId)?.wins ?? 0),
    );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Ranking · {community === "sand" ? "Areia" : "Quadra"}</h1>
        <p className="mt-1 text-sm text-white/60">Compare resultados e acompanhe sua posição em cada categoria.</p>
      </div>
      <RankingTabs
        currentProfileId={currentProfile.id}
        rankings={{ performance: performanceRanking, wins: winsRanking, mvp: mvpRanking, attendance: attendanceRanking }}
      />
    </div>
  );
}
