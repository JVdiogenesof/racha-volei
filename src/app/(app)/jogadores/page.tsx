import { Users } from "lucide-react";
import { canSeePlayerNotes } from "@/lib/noteVisibility";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { getAllRatings, getRatingWeights } from "@/lib/ratings";
import { finalScoresForPlayer, overallScore } from "@/lib/scoring";
import { getRankingCounts } from "@/lib/rankings";
import { countUnlockedLevels, getFeaturedAchievements } from "@/lib/achievements";
import { PlayerSearch } from "@/components/PlayerSearch";
import { badgeStatsFrom, getBadgeCatalog } from "@/lib/profileCosmetics";
import type { EarnedBadge } from "@/lib/badges";
import { getActiveCommunity } from "@/lib/community";

export default async function JogadoresPage({ searchParams }: { searchParams: Promise<{ perfil?: string }> }) {
  const { perfil } = await searchParams;
  const profile = await requireProfile();
  const canSeeNotes = canSeePlayerNotes(profile);
  const supabase = await createClient();
  const community = await getActiveCommunity();

  const [{ data: players }, { selfByProfile, organizerByProfile }, weights, rankingCounts, badgeCatalog, { data: badgeRows }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, avatar_url, avatar_frame, is_setter, nickname_badge, profile_banner, profile_effect, featured_badges")
      .eq("status", "approved")
      .contains("communities", [community])
      .order("full_name"),
    getAllRatings(supabase),
    getRatingWeights(supabase),
    getRankingCounts(supabase, community),
    getBadgeCatalog(supabase),
    supabase.from("profile_badges").select("profile_id, badge_id, note, awarded_at").order("awarded_at", { ascending: false }),
  ]);

  const badgeById = new Map(badgeCatalog.map((badge) => [badge.id, badge]));
  const earnedByProfile = new Map<string, EarnedBadge[]>();
  for (const row of badgeRows ?? []) {
    const list = earnedByProfile.get(row.profile_id as string) ?? [];
    list.push({ badge_id: row.badge_id as string, note: (row.note as string | null) ?? null, awarded_at: row.awarded_at as string });
    earnedByProfile.set(row.profile_id as string, list);
  }

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
        streak: rankingCounts.streaks.get(p.id) ?? 0,
        isSetter: p.is_setter,
        ...badgeStatsFrom(earnedByProfile.get(p.id) ?? [], badgeCatalog),
      };
      const earnedBadges = (earnedByProfile.get(p.id) ?? []).flatMap((earned) => {
        const badge = badgeById.get(earned.badge_id);
        return badge ? [{ badge, earned }] : [];
      });
      const featuredBadges = ((p.featured_badges as string[] | null) ?? []).flatMap((id) => {
        const found = earnedBadges.find((item) => item.badge.id === id);
        return found ? [found.badge] : [];
      });
      return {
        ...p,
        earnedBadges,
        featuredBadges,
        overall: canSeeNotes ? overallScore(scores) : null,
        performance: rankingCounts.performance.get(p.id) ?? null,
        streak: achievementStats.streak,
        achievements: getFeaturedAchievements(achievementStats),
        achievementCount: countUnlockedLevels(achievementStats),
      };
    })
    .sort((a, b) =>
      canSeeNotes ? (b.overall ?? 0) - (a.overall ?? 0) : a.full_name.localeCompare(b.full_name, "pt-BR"),
    );

  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-purple-300/15 bg-purple-300/10">
          <Users className="h-5 w-5 text-purple-300" strokeWidth={2} />
        </span>
        <div>
          <h1 className="text-2xl font-black text-white">Jogadores · Quadra</h1>
          <p className="text-sm text-white/50">Toque em um jogador para ver o perfil completo.</p>
        </div>
      </div>

      <PlayerSearch players={rows} showNotes={canSeeNotes} initialPlayerId={perfil} />
    </div>
  );
}
