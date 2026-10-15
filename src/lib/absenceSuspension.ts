import type { SupabaseClient } from "@supabase/supabase-js";
import type { Community } from "./community";

// Suspende quem passou por mais desses rachas finalizados seguidos sem ficar
// confirmado(a). O contador reseta assim que a pessoa confirma de novo.
export const ABSENCE_SUSPENSION_THRESHOLD = 5;
// Olha só os rachas finalizados recentes -- o suficiente pra cobrir o streak
// mesmo que a pessoa não tenha ido em nenhum nesse intervalo todo.
const LOOKBACK_EVENT_COUNT = ABSENCE_SUSPENSION_THRESHOLD + 5;

/**
 * Roda depois que um racha é finalizado: olha os últimos rachas encerrados
 * da comunidade e suspende quem acumulou mais faltas seguidas que o limite,
 * contando só a partir do cadastro de cada jogador (pra não punir quem
 * entrou no grupo depois que esses rachas já tinham acontecido).
 */
export async function applyAbsenceSuspensions(supabase: SupabaseClient, community: Community) {
  const { data: events } = await supabase
    .from("events")
    .select("id, date")
    .eq("community", community)
    .eq("status", "finished")
    .order("date", { ascending: false })
    .limit(LOOKBACK_EVENT_COUNT);
  if (!events || events.length <= ABSENCE_SUSPENSION_THRESHOLD) return;

  const eventIds = events.map((event) => event.id);
  const [{ data: confirmedRows }, { data: players }] = await Promise.all([
    supabase.from("attendance").select("profile_id, event_id").eq("status", "confirmed").in("event_id", eventIds),
    supabase
      .from("profiles")
      .select("id, created_at")
      .eq("status", "approved")
      .eq("is_organizer", false)
      .contains("communities", [community]),
  ]);

  const confirmedEventIdsByProfile = new Map<string, Set<string>>();
  for (const row of confirmedRows ?? []) {
    const set = confirmedEventIdsByProfile.get(row.profile_id) ?? new Set<string>();
    set.add(row.event_id);
    confirmedEventIdsByProfile.set(row.profile_id, set);
  }

  const toSuspend: string[] = [];
  for (const player of players ?? []) {
    const eligibleEvents = events.filter(
      (event) => new Date(`${event.date}T00:00:00`) >= new Date(player.created_at),
    );
    if (eligibleEvents.length <= ABSENCE_SUSPENSION_THRESHOLD) continue;

    const confirmedEventIds = confirmedEventIdsByProfile.get(player.id) ?? new Set<string>();
    let streak = 0;
    for (const event of eligibleEvents) {
      if (confirmedEventIds.has(event.id)) break;
      streak += 1;
    }
    if (streak > ABSENCE_SUSPENSION_THRESHOLD) toSuspend.push(player.id);
  }

  if (!toSuspend.length) return;
  await supabase.from("profiles").update({ status: "suspended" }).in("id", toSuspend).eq("status", "approved");
}
