import type { SupabaseClient } from "@supabase/supabase-js";
import type { Badge, EarnedBadge } from "./badges";
import type { AchievementStats } from "./achievements";

export type ProfileExtras = {
  profile_banner: string | null;
  profile_effect: string | null;
  featured_badges: string[];
  seen_unlocks: string[];
};

const EMPTY_EXTRAS: ProfileExtras = { profile_banner: null, profile_effect: null, featured_badges: [], seen_unlocks: [] };

/** Catálogo completo de medalhas (poucas linhas). Falha silenciosa: tela segue sem medalhas. */
export async function getBadgeCatalog(supabase: SupabaseClient): Promise<Badge[]> {
  const { data } = await supabase.from("badges").select("id, title, description, emoji, kind, color, sort_order").order("sort_order").order("title");
  return (data ?? []) as Badge[];
}

export async function getEarnedBadges(supabase: SupabaseClient, profileId: string): Promise<EarnedBadge[]> {
  const { data } = await supabase
    .from("profile_badges")
    .select("badge_id, note, awarded_at")
    .eq("profile_id", profileId)
    .order("awarded_at", { ascending: false });
  return (data ?? []) as EarnedBadge[];
}

/** Colunas novas do perfil (ficam fora do cabeçalho de sessão pra ele não crescer). */
export async function getProfileExtras(supabase: SupabaseClient, profileId: string): Promise<ProfileExtras> {
  const { data } = await supabase
    .from("profiles")
    .select("profile_banner, profile_effect, featured_badges, seen_unlocks")
    .eq("id", profileId)
    .maybeSingle();
  return data ? { ...EMPTY_EXTRAS, ...(data as Partial<ProfileExtras>) } : EMPTY_EXTRAS;
}

/** Contagens de medalha que entram nas conquistas. */
export function badgeStatsFrom(earned: { badge_id: string }[], catalog: Pick<Badge, "id" | "kind">[]) {
  const kindById = new Map(catalog.map((badge) => [badge.id, badge.kind]));
  let tournamentBadges = 0;
  for (const item of earned) if (kindById.get(item.badge_id) === "tournament") tournamentBadges += 1;
  return { tournamentBadges, badgeCount: earned.length } satisfies Pick<AchievementStats, "tournamentBadges" | "badgeCount">;
}
