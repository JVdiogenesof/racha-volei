import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Quantos rachas seguidos (contando do mais recente já ocorrido pra trás)
 * cada jogador esteve confirmado, sem quebrar a sequência. Calculado na hora
 * a partir de `events`+`attendance` -- não guarda nada no banco.
 */
export async function getAttendanceStreaks(supabase: SupabaseClient): Promise<Map<string, number>> {
  const today = new Date().toISOString().slice(0, 10);

  const [{ data: events }, { data: attendanceRows }] = await Promise.all([
    supabase.from("events").select("id, date").lte("date", today).neq("status", "cancelled").order("date", { ascending: false }),
    supabase.from("attendance").select("event_id, profile_id").eq("status", "confirmed"),
  ]);

  const confirmedByEvent = new Map<string, Set<string>>();
  const allProfileIds = new Set<string>();
  for (const a of attendanceRows ?? []) {
    if (!confirmedByEvent.has(a.event_id)) confirmedByEvent.set(a.event_id, new Set());
    confirmedByEvent.get(a.event_id)!.add(a.profile_id);
    allProfileIds.add(a.profile_id);
  }

  const streaks = new Map<string, number>();
  for (const profileId of allProfileIds) {
    let streak = 0;
    for (const event of events ?? []) {
      if (!confirmedByEvent.get(event.id)?.has(profileId)) break;
      streak++;
    }
    if (streak > 0) streaks.set(profileId, streak);
  }

  return streaks;
}
