import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Presença de verdade, pra ranking/histórico: só conta quem estava
 * confirmado (ou já tinha entrado num time -- cobre substituição de última
 * hora feita direto no time, sem passar pela confirmação) num racha que já
 * foi encerrado pelo organizador. Alguém que confirma e depois sai antes do
 * racha nunca chega a contar, e ninguém conta presença num racha que ainda
 * nem aconteceu.
 */
export async function getPresentProfileIdsByEvent(
  supabase: SupabaseClient,
  finishedEventIds: string[],
): Promise<Map<string, Set<string>>> {
  const present = new Map<string, Set<string>>();
  if (!finishedEventIds.length) return present;

  const addPresent = (eventId: string, profileId: string) => {
    if (!present.has(eventId)) present.set(eventId, new Set());
    present.get(eventId)!.add(profileId);
  };

  const [{ data: attendanceRows }, { data: generations }] = await Promise.all([
    supabase
      .from("attendance")
      .select("event_id, profile_id")
      .eq("status", "confirmed")
      .in("event_id", finishedEventIds),
    supabase
      .from("team_generations")
      .select("id, event_id")
      .in("event_id", finishedEventIds)
      .order("generated_at", { ascending: false }),
  ]);

  for (const a of attendanceRows ?? []) addPresent(a.event_id, a.profile_id);

  // Só a geração mais recente de cada racha conta -- times regenerados
  // depois substituem os anteriores, igual em todo o resto do site.
  const latestGenIdByEvent = new Map<string, string>();
  for (const g of generations ?? []) {
    if (!latestGenIdByEvent.has(g.event_id)) latestGenIdByEvent.set(g.event_id, g.id);
  }
  const genIds = [...latestGenIdByEvent.values()];
  if (!genIds.length) return present;

  const { data: teamRows } = await supabase.from("teams").select("id, generation_id").in("generation_id", genIds);
  const eventIdByGenId = new Map((generations ?? []).map((g) => [g.id, g.event_id]));
  const eventIdByTeamId = new Map(
    (teamRows ?? [])
      .map((t) => [t.id, eventIdByGenId.get(t.generation_id)] as const)
      .filter((pair): pair is [string, string] => !!pair[1]),
  );
  const teamIds = [...eventIdByTeamId.keys()];
  if (!teamIds.length) return present;

  const { data: memberRows } = await supabase.from("team_members").select("team_id, profile_id").in("team_id", teamIds);
  for (const m of memberRows ?? []) {
    const eventId = eventIdByTeamId.get(m.team_id);
    if (eventId) addPresent(eventId, m.profile_id);
  }

  return present;
}
