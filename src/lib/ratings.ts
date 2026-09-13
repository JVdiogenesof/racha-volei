import type { SupabaseClient } from "@supabase/supabase-js";
import { SKILL_CATEGORIES, type RatingsByCategory, type SkillCategory } from "@/lib/scoring";

// Linha única (singleton) de configuração de pesos.
export const RATING_WEIGHTS_ID = "00000000-0000-0000-0000-000000000001";

export interface Weights {
  selfWeight: number;
  organizerWeight: number;
}

export async function getRatingWeights(supabase: SupabaseClient): Promise<Weights> {
  const { data } = await supabase
    .from("rating_weights")
    .select("self_weight, organizer_weight")
    .eq("id", RATING_WEIGHTS_ID)
    .maybeSingle();

  return {
    selfWeight: data ? Number(data.self_weight) : 0.4,
    organizerWeight: data ? Number(data.organizer_weight) : 0.6,
  };
}

function groupByProfile(
  rows: { profile_id: string; category: SkillCategory; value: string | number }[] | null,
): Map<string, RatingsByCategory> {
  const map = new Map<string, RatingsByCategory>();
  for (const row of rows ?? []) {
    const entry = map.get(row.profile_id) ?? {};
    entry[row.category] = Number(row.value);
    map.set(row.profile_id, entry);
  }
  return map;
}

export async function getAllRatings(supabase: SupabaseClient) {
  const [selfRes, organizerRes] = await Promise.all([
    supabase.from("self_ratings").select("profile_id, category, value"),
    supabase.from("organizer_ratings").select("profile_id, category, value"),
  ]);

  return {
    selfByProfile: groupByProfile(selfRes.data),
    organizerByProfile: groupByProfile(organizerRes.data),
  };
}

/**
 * Igual getAllRatings, mas só busca as notas de quem está em profileIds —
 * usa quando só precisa de um grupo pequeno (ex: confirmados de um racha),
 * pra não trazer a tabela inteira de notas de todo mundo do app à toa.
 */
export async function getRatingsFor(supabase: SupabaseClient, profileIds: string[]) {
  if (!profileIds.length) {
    return { selfByProfile: new Map<string, RatingsByCategory>(), organizerByProfile: new Map<string, RatingsByCategory>() };
  }

  const [selfRes, organizerRes] = await Promise.all([
    supabase.from("self_ratings").select("profile_id, category, value").in("profile_id", profileIds),
    supabase.from("organizer_ratings").select("profile_id, category, value").in("profile_id", profileIds),
  ]);

  return {
    selfByProfile: groupByProfile(selfRes.data),
    organizerByProfile: groupByProfile(organizerRes.data),
  };
}

export async function getPlayerRatings(supabase: SupabaseClient, profileId: string) {
  const [selfRes, organizerRes] = await Promise.all([
    supabase.from("self_ratings").select("category, value").eq("profile_id", profileId),
    supabase.from("organizer_ratings").select("category, value").eq("profile_id", profileId),
  ]);

  const self: RatingsByCategory = {};
  for (const row of selfRes.data ?? []) self[row.category as SkillCategory] = Number(row.value);

  const organizer: RatingsByCategory = {};
  for (const row of organizerRes.data ?? [])
    organizer[row.category as SkillCategory] = Number(row.value);

  return { self, organizer };
}

export { SKILL_CATEGORIES };
