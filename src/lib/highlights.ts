import type { SupabaseClient } from "@supabase/supabase-js";
import { getRatingsFor, getRatingWeights } from "@/lib/ratings";
import { finalScoresForPlayer, overallScore } from "@/lib/scoring";

export type PlayerHighlight = {
  profileId: string;
  fullName: string;
  avatarUrl: string | null;
  overall: number;
};

/**
 * Os 3 confirmados com melhor nota geral e os 2 levantadores confirmados com
 * melhor nota -- usado pra animar quem ainda não confirmou presença a ver
 * quem já vai jogar, sem revelar a lista de confirmados inteira.
 */
export async function getConfirmedHighlights(
  supabase: SupabaseClient,
  eventId: string,
): Promise<{ topOverall: PlayerHighlight[]; topSetters: PlayerHighlight[] }> {
  const { data: confirmedAttendance } = await supabase
    .from("attendance")
    .select("profile_id")
    .eq("event_id", eventId)
    .eq("status", "confirmed");

  const confirmedIds = (confirmedAttendance ?? []).map((a) => a.profile_id);
  if (!confirmedIds.length) return { topOverall: [], topSetters: [] };

  const [{ data: profiles }, { selfByProfile, organizerByProfile }, weights] = await Promise.all([
    supabase.from("profiles").select("id, full_name, avatar_url, is_setter").in("id", confirmedIds),
    getRatingsFor(supabase, confirmedIds),
    getRatingWeights(supabase),
  ]);

  const ranked = (profiles ?? [])
    .map((p) => {
      const scores = finalScoresForPlayer(
        selfByProfile.get(p.id) ?? {},
        organizerByProfile.get(p.id) ?? {},
        weights.selfWeight,
        weights.organizerWeight,
      );
      return {
        profileId: p.id,
        fullName: p.full_name,
        avatarUrl: p.avatar_url,
        overall: overallScore(scores),
        isSetter: p.is_setter,
      };
    })
    .sort((a, b) => b.overall - a.overall);

  return {
    topOverall: ranked.slice(0, 3),
    topSetters: ranked.filter((p) => p.isSetter).slice(0, 2),
  };
}
