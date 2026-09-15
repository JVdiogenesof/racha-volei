import type { SupabaseClient } from "@supabase/supabase-js";
import { getPresentProfileIdsByEvent } from "./presence";

/**
 * Quantos rachas seguidos (contando do mais recente já encerrado pra trás)
 * cada jogador esteve presente de verdade, sem quebrar a sequência. Um racha
 * só entra na conta depois de encerrado -- confirmar presença num racha que
 * ainda vai rolar não conta ainda.
 */
export async function getAttendanceStreaks(supabase: SupabaseClient): Promise<Map<string, number>> {
  const { data: events } = await supabase
    .from("events")
    .select("id, date")
    .eq("status", "finished")
    .order("date", { ascending: false });

  const finishedEventIds = (events ?? []).map((e) => e.id);
  const presentByEvent = await getPresentProfileIdsByEvent(supabase, finishedEventIds);

  const allProfileIds = new Set<string>();
  for (const profileIds of presentByEvent.values()) {
    for (const profileId of profileIds) allProfileIds.add(profileId);
  }

  const streaks = new Map<string, number>();
  for (const profileId of allProfileIds) {
    let streak = 0;
    for (const event of events ?? []) {
      if (!presentByEvent.get(event.id)?.has(profileId)) break;
      streak++;
    }
    if (streak > 0) streaks.set(profileId, streak);
  }

  return streaks;
}
