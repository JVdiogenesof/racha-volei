import type { SupabaseClient } from "@supabase/supabase-js";
import type { Community } from "./community";
import { getPresentProfileIdsByEvent } from "./presence";
import { sendPushToProfiles } from "./push";

// Regulamento de Permanência do VPA: 4 rachas finalizados seguidos sem
// participação alertam o jogador; 6 seguidos removem do grupo.
export const ATTENDANCE_ALERT_THRESHOLD = 4;
export const ATTENDANCE_REMOVE_THRESHOLD = 6;
// Olha só os rachas finalizados recentes -- o suficiente pra cobrir o streak
// mesmo que a pessoa não tenha ido em nenhum nesse intervalo todo.
const LOOKBACK_EVENT_COUNT = ATTENDANCE_REMOVE_THRESHOLD + 5;

/**
 * Roda depois que um racha é finalizado: olha os últimos rachas encerrados
 * da comunidade e, contando só a partir do cadastro de cada jogador (pra não
 * punir quem entrou no grupo depois que esses rachas já tinham acontecido),
 * alerta quem acumulou 4 faltas seguidas e remove quem chegou a 6 --
 * perdendo a vaga de torneio reservada (o Índice e Torneios VPA já ignoram
 * quem não está "approved", então a pontuação e a vaga somem sozinhas das
 * telas assim que o status muda).
 */
export async function applyAttendancePolicy(supabase: SupabaseClient, community: Community) {
  const { data: events } = await supabase
    .from("events")
    .select("id, date")
    .eq("community", community)
    .eq("status", "finished")
    .order("date", { ascending: false })
    .limit(LOOKBACK_EVENT_COUNT);
  if (!events || events.length < ATTENDANCE_ALERT_THRESHOLD) return;

  const eventIds = events.map((event) => event.id);
  const [presentByEvent, { data: players }] = await Promise.all([
    getPresentProfileIdsByEvent(supabase, eventIds),
    supabase
      .from("profiles")
      .select("id, created_at")
      .in("status", ["approved", "suspended"])
      .eq("is_organizer", false)
      .contains("communities", [community]),
  ]);

  const toAlert: string[] = [];
  const toRemove: string[] = [];
  for (const player of players ?? []) {
    const eligibleEvents = events.filter(
      (event) => new Date(`${event.date}T00:00:00`) >= new Date(player.created_at),
    );
    if (eligibleEvents.length < ATTENDANCE_ALERT_THRESHOLD) continue;

    let streak = 0;
    for (const event of eligibleEvents) {
      if (presentByEvent.get(event.id)?.has(player.id)) break;
      streak += 1;
    }

    if (streak >= ATTENDANCE_REMOVE_THRESHOLD) toRemove.push(player.id);
    // Só no momento exato em que cruza 4 -- senão alertaria de novo a cada
    // racha enquanto a pessoa segue ausente entre o 4º e o 6º.
    else if (streak === ATTENDANCE_ALERT_THRESHOLD) toAlert.push(player.id);
  }

  if (toRemove.length) {
    await supabase
      .from("profiles")
      .update({ status: "removed" })
      .in("id", toRemove)
      .in("status", ["approved", "suspended"]);
    await supabase.from("tournament_reserved_players").delete().eq("community", community).in("profile_id", toRemove);
    await sendPushToProfiles(supabase, toRemove, {
      title: "Você foi removido do VPA",
      body: "6 rachas seguidos sem participar. Pra voltar, entre pela lista de reserva -- sem vaga garantida.",
      url: "/",
    });
  }

  if (toAlert.length) {
    await sendPushToProfiles(supabase, toAlert, {
      title: "Fica de olho! ⚠️",
      body: "Você está há 4 rachas seguidos sem participar. Com 6 seguidos, o acesso é removido automaticamente.",
      url: "/",
    });
  }
}
