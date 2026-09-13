import type { SupabaseClient } from "@supabase/supabase-js";
import { getRatingsFor, getRatingWeights } from "@/lib/ratings";
import { finalScoresForPlayer, overallScore } from "@/lib/scoring";

/**
 * Média das notas finais de quem está confirmado nesse racha (0-5), ou null
 * se ainda ninguém confirmou presença. Usado tanto na tela do racha quanto
 * no card "Próximo racha" da home.
 */
export async function getRachaLevel(supabase: SupabaseClient, eventId: string): Promise<number | null> {
  const { data: confirmedAttendance } = await supabase
    .from("attendance")
    .select("profile_id")
    .eq("event_id", eventId)
    .eq("status", "confirmed");

  if (!confirmedAttendance?.length) return null;

  const confirmedIds = confirmedAttendance.map((a) => a.profile_id);
  const [{ selfByProfile, organizerByProfile }, weights] = await Promise.all([
    getRatingsFor(supabase, confirmedIds),
    getRatingWeights(supabase),
  ]);

  const sum = confirmedAttendance.reduce((acc, a) => {
    const scores = finalScoresForPlayer(
      selfByProfile.get(a.profile_id) ?? {},
      organizerByProfile.get(a.profile_id) ?? {},
      weights.selfWeight,
      weights.organizerWeight,
    );
    return acc + overallScore(scores);
  }, 0);

  return sum / confirmedAttendance.length;
}
