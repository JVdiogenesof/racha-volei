import { createClient } from "@/lib/supabase/server";
import { getActiveCommunity } from "@/lib/community";
import { getRankingCounts } from "@/lib/rankings";
import { getBadgeCatalog, getEarnedBadges, badgeStatsFrom } from "@/lib/profileCosmetics";
import { getUnlockedLevelIds, type AchievementStats } from "@/lib/achievements";

/** Estatísticas que alimentam as conquistas (as mesmas da tela de perfil). */
export async function loadAchievementStats(profile: { id: string; is_setter: boolean }): Promise<AchievementStats> {
  const supabase = await createClient();
  const community = await getActiveCommunity();
  const [counts, earned, catalog] = await Promise.all([
    getRankingCounts(supabase, community),
    getEarnedBadges(supabase, profile.id),
    getBadgeCatalog(supabase),
  ]);
  return {
    attendance: counts.attendance.get(profile.id) ?? 0,
    wins: counts.wins.get(profile.id) ?? 0,
    mvp: counts.mvp.get(profile.id) ?? 0,
    streak: counts.streaks.get(profile.id) ?? 0,
    isSetter: profile.is_setter,
    ...badgeStatsFrom(earned, catalog),
  };
}

export async function loadUnlockedLevelIds(profile: { id: string; is_setter: boolean }): Promise<string[]> {
  return [...getUnlockedLevelIds(await loadAchievementStats(profile))];
}
