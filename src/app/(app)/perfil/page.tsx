import { CalendarCheck, Trophy, Crown, Percent, Scale, LayoutGrid, Palette, Medal, Sparkles } from "lucide-react";
import { canSeePlayerNotes } from "@/lib/noteVisibility";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { getPlayerRatings, getRatingWeights } from "@/lib/ratings";
import { getRankingCounts } from "@/lib/rankings";
import { formatPointsDiff, getSeasonRanking, ROLLING_INDEX_EVENT_COUNT } from "@/lib/seasonRanking";
import { SKILL_CATEGORIES, SKILL_LABELS, finalScoresForPlayer, overallScore } from "@/lib/scoring";
import { ScoreBar } from "@/components/ScoreBar";
import { AchievementTracks } from "@/components/AchievementTracks";
import { getAchievementTracks, getClassicAchievements, getFeaturedAchievements, playStatsFor } from "@/lib/achievements";
import { BadgeShowcase } from "@/components/BadgeShowcase";
import { PersonalizarHub } from "@/components/PersonalizarHub";
import { ProfileTabs } from "@/components/ProfileTabs";
import { UnlockCelebration, type NewUnlock } from "@/components/UnlockCelebration";
import { badgeStatsFrom, getBadgeCatalog, getEarnedBadges, getProfileExtras } from "@/lib/profileCosmetics";
import { getPlayerRankingPositions } from "@/lib/playerCard";
import { SharePlayerCard } from "@/components/SharePlayerCard";
import { getActiveCommunity } from "@/lib/community";
import { AnimatedMetric } from "@/components/AnimatedMetric";

export default async function PerfilPage({ searchParams }: { searchParams: Promise<{ aba?: string }> }) {
  const { aba } = await searchParams;
  const profile = await requireProfile();
  const supabase = await createClient();
  const community = await getActiveCommunity();
  const [{ self, organizer }, weights, rankingCounts, seasonScores, { data: approvedProfiles }, extras, badgeCatalog, earnedBadges] = await Promise.all([
    getPlayerRatings(supabase, profile.id),
    getRatingWeights(supabase),
    getRankingCounts(supabase, community),
    getSeasonRanking(supabase, community),
    supabase.from("profiles").select("id").eq("status", "approved").contains("communities", [community]),
    getProfileExtras(supabase, profile.id),
    getBadgeCatalog(supabase),
    getEarnedBadges(supabase, profile.id),
  ]);

  const finalScores = finalScoresForPlayer(self, organizer, weights.selfWeight, weights.organizerWeight);
  const overall = overallScore(finalScores);
  const attendanceCount = rankingCounts.attendance.get(profile.id) ?? 0;
  const mvpCount = rankingCounts.mvp.get(profile.id) ?? 0;
  const winsCount = rankingCounts.wins.get(profile.id) ?? 0;
  const season = seasonScores.get(profile.id);
  const seasonMatches = season ? season.totalWins + season.totalLosses : 0;
  const seasonPercentage = season && seasonMatches > 0 ? Math.round((season.totalWins / seasonMatches) * 100) : null;
  const streak = rankingCounts.streaks.get(profile.id) ?? 0;
  const hasPointBalance = Boolean(season && season.pointsFor + season.pointsAgainst > 0);

  const myStats = [
    { label: "Presenças", value: attendanceCount, icon: CalendarCheck },
    { label: "Vezes destaque", value: mvpCount, icon: Trophy },
    { label: "Vitórias", value: winsCount, icon: Crown },
    {
      label: season ? `${season.totalWins}V · ${season.totalLosses}D` : "Sem confrontos",
      value: seasonPercentage !== null ? `${seasonPercentage}%` : "—",
      icon: Percent,
    },
    {
      label: hasPointBalance ? `Saldo de pontos · últimos ${ROLLING_INDEX_EVENT_COUNT} rachas` : "Saldo de pontos",
      value: hasPointBalance && season ? formatPointsDiff(season.pointsDiff) : "—",
      icon: Scale,
    },
  ];
  const achievementStats = {
    attendance: attendanceCount,
    wins: winsCount,
    mvp: mvpCount,
    streak,
    isSetter: profile.is_setter,
    ...badgeStatsFrom(earnedBadges, badgeCatalog),
    ...playStatsFor(rankingCounts, profile.id),
  };
  const tracks = getAchievementTracks(achievementStats);
  const seen = new Set(extras.seen_unlocks);
  const newUnlocks: NewUnlock[] = tracks.flatMap((track) =>
    track.levels
      .filter((level) => level.unlocked && !seen.has(level.id))
      .map((level) => ({ levelId: level.id, trackTitle: track.title, glyph: track.glyph, tier: level.tier, rewards: level.rewards })),
  );
  const earnedIds = new Set(earnedBadges.map((item) => item.badge_id));
  const featuredBadges = extras.featured_badges
    .filter((id) => earnedIds.has(id))
    .map((id) => badgeCatalog.find((badge) => badge.id === id))
    .filter((badge): badge is NonNullable<typeof badge> => Boolean(badge));
  const rankingPositions = getPlayerRankingPositions(
    rankingCounts,
    seasonScores,
    profile.id,
    (approvedProfiles ?? []).map((item) => item.id),
  );
  const featuredAchievements = getFeaturedAchievements(achievementStats);

  const unlockedLevelCount = tracks.reduce((sum, track) => sum + track.levels.filter((level) => level.unlocked).length, 0);

  const overview = (
    <div className="space-y-8">
      <section>
        <h2 className="font-semibold text-white">Meu histórico</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {myStats.map((s) => (
            <div key={s.label} className="rounded-xl border border-white/10 bg-white/5 p-4 text-center sm:last:col-span-2 lg:last:col-span-1">
              <s.icon className="mx-auto h-5 w-5 text-purple-300" strokeWidth={2} />
              <AnimatedMetric className="mt-2 block text-xl font-bold text-white" value={s.value} />
              <p className="text-xs text-white/60">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {canSeePlayerNotes(profile) && (
        <section className="rounded-xl border border-white/10 p-6">
          <h2 className="font-semibold text-white">Nota final</h2>
          <p className="mt-1 text-sm text-white/60">Geral: {overall.toFixed(1)} / 5</p>
          <div className="mt-4 space-y-3">
            {SKILL_CATEGORIES.map((c) => (
              <ScoreBar key={c} label={SKILL_LABELS[c]} value={finalScores[c]} />
            ))}
          </div>
        </section>
      )}
    </div>
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Meu perfil</h1>
        <p className="mt-1 text-sm text-white/60">Seu cartão, seu visual, suas medalhas e conquistas.</p>
      </div>

      <SharePlayerCard
        fullName={profile.full_name}
        avatarUrl={profile.avatar_url}
        nickname={profile.nickname_badge}
        stats={{
          attendance: attendanceCount,
          wins: winsCount,
          mvp: mvpCount,
          performance: seasonPercentage,
        }}
        rankings={rankingPositions}
        achievements={featuredAchievements.map(({ title, glyph, tier }) => ({ title, glyph, tier }))}
        achievementCount={unlockedLevelCount}
        avatarFrame={profile.avatar_frame}
        banner={extras.profile_banner}
        effect={extras.profile_effect}
        isSetter={profile.is_setter}
        featuredBadges={featuredBadges}
      />

      <ProfileTabs
        initial={aba}
        tabs={[
          { id: "visao", label: "Visão geral", icon: <LayoutGrid className="h-3.5 w-3.5" aria-hidden />, content: overview },
          {
            id: "personalizar",
            label: "Personalizar",
            highlight: true,
            icon: <Palette className="h-3.5 w-3.5" aria-hidden />,
            content: (
              <PersonalizarHub
                fullName={profile.full_name}
                avatarUrl={profile.avatar_url}
                nickname={profile.nickname_badge}
                isSetter={profile.is_setter}
                frame={profile.avatar_frame}
                banner={extras.profile_banner}
                effect={extras.profile_effect}
                featuredBadges={featuredBadges}
              />
            ),
          },
          {
            id: "medalhas",
            label: "Medalhas",
            icon: <Medal className="h-3.5 w-3.5" aria-hidden />,
            content: <BadgeShowcase catalog={badgeCatalog} earned={earnedBadges} featuredIds={extras.featured_badges} />,
          },
          {
            id: "conquistas",
            label: "Conquistas",
            icon: <Sparkles className="h-3.5 w-3.5" aria-hidden />,
            badge: newUnlocks.length || undefined,
            content: <AchievementTracks tracks={tracks} classics={getClassicAchievements(achievementStats)} />,
          },
        ]}
      />

      <UnlockCelebration unlocks={newUnlocks} />
    </div>
  );
}
