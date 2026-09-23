import { CalendarCheck, Trophy, Crown, Percent } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { getRankingCounts } from "@/lib/rankings";
import { Leaderboard, type RankingEntry } from "@/components/Leaderboard";

export default async function RankingPage() {
  await requireProfile();
  const supabase = await createClient();

  const [{ data: profiles }, counts] = await Promise.all([
    supabase.from("profiles").select("id, full_name, avatar_url").eq("status", "approved"),
    getRankingCounts(supabase),
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
        count: stats.percentage,
        fullName: profile.full_name,
        avatarUrl: profile.avatar_url,
        displayValue: `${stats.percentage}%`,
        detail: `${stats.wins}V · ${stats.losses}D`,
      }];
    })
    .sort(
      (a, b) =>
        b.count - a.count ||
        (counts.performance.get(b.profileId)?.wins ?? 0) - (counts.performance.get(a.profileId)?.wins ?? 0),
    );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Ranking</h1>
        <p className="mt-1 text-sm text-white/60">Quem mais aparece e quem mais brilha nos rachas.</p>
      </div>

      <Leaderboard
        title="Melhor aproveitamento"
        icon={<Percent className="h-5 w-5 text-purple-300" strokeWidth={2} />}
        unit="de aproveitamento"
        ranking={performanceRanking}
      />

      <Leaderboard
        title="Mais vitórias"
        icon={<Crown className="h-5 w-5 text-purple-300" strokeWidth={2} />}
        unit="vitórias"
        ranking={winsRanking}
      />

      <Leaderboard
        title="Mais vezes Jogador Destaque"
        icon={<Trophy className="h-5 w-5 text-purple-300" strokeWidth={2} />}
        unit="vezes"
        ranking={mvpRanking}
      />

      <Leaderboard
        title="Mais presença"
        icon={<CalendarCheck className="h-5 w-5 text-purple-300" strokeWidth={2} />}
        unit="presenças"
        ranking={attendanceRanking}
      />
    </div>
  );
}
