import type { SupabaseClient } from "@supabase/supabase-js";
import type { Community } from "./community";
import { getPresentProfileIdsByEvent } from "./presence";
import { sendPushToProfiles } from "./push";

// Regulamento de Permanência do VPA: 4 FINS DE SEMANA seguidos sem participação
// alertam o jogador; 6 seguidos removem do grupo. Cada fim de semana (sábado +
// domingo) conta uma vez: quem vai a qualquer racha dele não tem falta. Conta
// racha normal, pré-torneio e mini torneio (menos os marcados para não contar
// no ranking).
export const ATTENDANCE_ALERT_THRESHOLD = 4;
export const ATTENDANCE_REMOVE_THRESHOLD = 6;
// Olha só os rachas finalizados recentes -- o suficiente pra cobrir o streak
// mesmo que a pessoa não tenha ido em nenhum nesse intervalo todo.
const LOOKBACK_EVENT_COUNT = (ATTENDANCE_REMOVE_THRESHOLD + 3) * 2;

/** Domingo do fim de semana do racha (sábado e domingo caem na mesma chave). */
export function weekendKey(date: string) {
  const day = new Date(`${date.slice(0, 10)}T12:00:00Z`);
  day.setUTCDate(day.getUTCDate() + ((7 - day.getUTCDay()) % 7));
  return day.toISOString().slice(0, 10);
}

type StreakPlayer = { id: string; created_at: string; absence_counts_from: string | null };

/**
 * Faltas seguidas de cada membro da comunidade, contando de trás pra frente a
 * partir do racha finalizado mais recente. A contagem começa no cadastro da
 * pessoa (ou na data em que um organizador restaurou o acesso dela), pra não
 * punir quem entrou -- ou voltou -- depois que esses rachas já aconteceram.
 *
 * Mesma fonte usada pela remoção automática e pelos avisos na tela, pra que
 * o número que o jogador vê seja exatamente o que vale na hora de remover.
 */
export async function getAbsenceStreaks(
  supabase: SupabaseClient,
  community: Community,
): Promise<Map<string, number>> {
  const streaks = new Map<string, number>();

  const { data: events } = await supabase
    .from("events")
    .select("id, date")
    .eq("community", community)
    .eq("status", "finished")
    .eq("counts_for_ranking", true)
    .order("date", { ascending: false })
    .limit(LOOKBACK_EVENT_COUNT);
  if (!events?.length) return streaks;

  // Do fim de semana mais recente para trás.
  const weekends: { date: string; id: string }[][] = [];
  for (const event of events) {
    const last = weekends[weekends.length - 1];
    if (last && weekendKey(last[0].date) === weekendKey(event.date)) last.push(event);
    else weekends.push([event]);
  }

  const [presentByEvent, { data: players }] = await Promise.all([
    getPresentProfileIdsByEvent(supabase, events.map((event) => event.id)),
    supabase
      .from("profiles")
      .select("id, created_at, absence_counts_from")
      .in("status", ["approved", "suspended"])
      .eq("is_organizer", false)
      .contains("communities", [community]),
  ]);

  for (const player of (players ?? []) as StreakPlayer[]) {
    const countsFrom = new Date(player.absence_counts_from ?? player.created_at);
    let streak = 0;
    for (const weekend of weekends) {
      const counted = weekend.filter((event) => new Date(`${event.date}T00:00:00`) >= countsFrom);
      if (!counted.length) break;
      if (counted.some((event) => presentByEvent.get(event.id)?.has(player.id))) break;
      streak += 1;
    }
    streaks.set(player.id, streak);
  }

  return streaks;
}

/**
 * Roda depois que um racha é finalizado: alerta quem acumulou 4 faltas
 * seguidas e remove quem chegou a 6 -- perdendo a vaga de torneio reservada
 * (o Índice e Torneios VPA já ignoram quem não está "approved", então a
 * pontuação e a vaga somem sozinhas das telas assim que o status muda).
 */
export async function applyAttendancePolicy(supabase: SupabaseClient, community: Community) {
  const streaks = await getAbsenceStreaks(supabase, community);
  if (!streaks.size) return;

  const toAlert: string[] = [];
  const toRemove: string[] = [];
  for (const [profileId, streak] of streaks) {
    if (streak >= ATTENDANCE_REMOVE_THRESHOLD) toRemove.push(profileId);
    // Só no momento exato em que cruza 4 -- senão alertaria de novo a cada
    // racha enquanto a pessoa segue ausente entre o 4º e o 6º.
    else if (streak === ATTENDANCE_ALERT_THRESHOLD) toAlert.push(profileId);
  }

  if (toRemove.length) {
    await supabase
      .from("profiles")
      .update({ status: "removed", absence_removed_at: new Date().toISOString() })
      .in("id", toRemove)
      .in("status", ["approved", "suspended"]);
    await supabase.from("tournament_reserved_players").delete().eq("community", community).in("profile_id", toRemove);
    await sendPushToProfiles(supabase, toRemove, {
      title: "Você foi removido do VPA",
      body: "6 fins de semana seguidos sem participar. Pra voltar, entre pela lista de reserva -- sem vaga garantida.",
      url: "/",
    });
  }

  if (toAlert.length) {
    await sendPushToProfiles(supabase, toAlert, {
      title: "Fica de olho! ⚠️",
      body: "Você está há 4 fins de semana seguidos sem participar. Com 6 seguidos, o acesso é removido automaticamente.",
      url: "/",
    });
  }
}
