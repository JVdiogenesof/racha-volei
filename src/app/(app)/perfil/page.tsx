import { CalendarCheck, Trophy, Crown, Percent } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { getPlayerRatings, getRatingWeights } from "@/lib/ratings";
import { getRankingCounts } from "@/lib/rankings";
import { getAttendanceStreaks } from "@/lib/streak";
import { SKILL_CATEGORIES, SKILL_LABELS, finalScoresForPlayer, overallScore } from "@/lib/scoring";
import { ScoreBar } from "@/components/ScoreBar";
import { AchievementGallery } from "@/components/AchievementGallery";
import { getFeaturedAchievements, getPlayerAchievements } from "@/lib/achievements";
import { getPlayerRankingPositions } from "@/lib/playerCard";
import { SharePlayerCard } from "@/components/SharePlayerCard";

export default async function PerfilPage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const [{ self, organizer }, weights, rankingCounts, streaks, { data: approvedProfiles }] = await Promise.all([
    getPlayerRatings(supabase, profile.id),
    getRatingWeights(supabase),
    getRankingCounts(supabase),
    getAttendanceStreaks(supabase),
    supabase.from("profiles").select("id").eq("status", "approved"),
  ]);

  const finalScores = finalScoresForPlayer(self, organizer, weights.selfWeight, weights.organizerWeight);
  const overall = overallScore(finalScores);
  const attendanceCount = rankingCounts.attendance.get(profile.id) ?? 0;
  const mvpCount = rankingCounts.mvp.get(profile.id) ?? 0;
  const winsCount = rankingCounts.wins.get(profile.id) ?? 0;
  const performance = rankingCounts.performance.get(profile.id);
  const streak = streaks.get(profile.id) ?? 0;

  const myStats = [
    { label: "Presenças", value: attendanceCount, icon: CalendarCheck },
    { label: "Vezes destaque", value: mvpCount, icon: Trophy },
    { label: "Vitórias", value: winsCount, icon: Crown },
    {
      label: performance ? `${performance.wins}V · ${performance.losses}D` : "Sem confrontos",
      value: performance ? `${performance.percentage}%` : "—",
      icon: Percent,
    },
  ];
  const achievementStats = {
    attendance: attendanceCount,
    wins: winsCount,
    mvp: mvpCount,
    streak,
    isSetter: profile.is_setter,
  };
  const achievements = getPlayerAchievements(achievementStats);
  const rankingPositions = getPlayerRankingPositions(
    rankingCounts,
    profile.id,
    (approvedProfiles ?? []).map((item) => item.id),
  );
  const featuredAchievements = getFeaturedAchievements(achievementStats);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-white">Meu perfil</h1>
        <p className="mt-1 text-sm text-white/60">Suas estatísticas, rankings e conquistas dentro da quadra.</p>
      </div>

      <SharePlayerCard
        fullName={profile.full_name}
        avatarUrl={profile.avatar_url}
        nickname={profile.nickname_badge}
        stats={{
          attendance: attendanceCount,
          wins: winsCount,
          mvp: mvpCount,
          performance: performance?.percentage ?? null,
        }}
        rankings={rankingPositions}
        achievements={featuredAchievements.map(({ title, emoji }) => ({ title, emoji }))}
        achievementCount={achievements.filter((achievement) => achievement.unlocked).length}
      />

      <section>
        <h2 className="font-semibold text-white">Meu histórico</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {myStats.map((s) => (
            <div key={s.label} className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
              <s.icon className="mx-auto h-5 w-5 text-purple-300" strokeWidth={2} />
              <p className="mt-2 text-xl font-bold text-white">{s.value}</p>
              <p className="text-xs text-white/60">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      <AchievementGallery achievements={achievements} />

      <section className="rounded-xl border border-white/10 p-6">
        <h2 className="font-semibold text-white">Nota final</h2>
        <p className="mt-1 text-sm text-white/60">Geral: {overall.toFixed(1)} / 5</p>
        <div className="mt-4 space-y-3">
          {SKILL_CATEGORIES.map((c) => (
            <ScoreBar key={c} label={SKILL_LABELS[c]} value={finalScores[c]} />
          ))}
        </div>
      </section>
    </div>
  );
}
