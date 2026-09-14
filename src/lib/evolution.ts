import type { SupabaseClient } from "@supabase/supabase-js";

export type EvolutionEntry = {
  eventId: string;
  date: string;
  location: string | null;
  status: "confirmed" | "interested" | "declined";
  wasDestaque: boolean;
  /** Quantas vezes o time desse jogador venceu nesse racha (pode ser mais de uma). */
  teamWins: number;
};

/**
 * Linha do tempo pessoal de um jogador: pra cada racha que ele respondeu,
 * mostra se esteve confirmado, se foi Jogador Destaque e se o time dele
 * venceu. Tudo calculado na hora a partir de tabelas já existentes -- não
 * guarda nada novo no banco.
 */
export async function getPersonalEvolution(supabase: SupabaseClient, profileId: string): Promise<EvolutionEntry[]> {
  const { data: attendanceRows } = await supabase
    .from("attendance")
    .select("event_id, status")
    .eq("profile_id", profileId);

  const eventIds = (attendanceRows ?? []).map((a) => a.event_id);
  if (!eventIds.length) return [];

  const { data: events } = await supabase
    .from("events")
    .select("id, date, location, mvp_profile_id, mvp_profile_id_2")
    .in("id", eventIds);

  const eventById = new Map((events ?? []).map((e) => [e.id, e]));

  const entries: EvolutionEntry[] = (attendanceRows ?? [])
    .map((a) => {
      const event = eventById.get(a.event_id);
      if (!event) return null;
      return {
        eventId: event.id,
        date: event.date,
        location: event.location,
        status: a.status as EvolutionEntry["status"],
        wasDestaque: event.mvp_profile_id === profileId || event.mvp_profile_id_2 === profileId,
        teamWins: 0,
      };
    })
    .filter((e): e is EvolutionEntry => e !== null)
    .sort((a, b) => b.date.localeCompare(a.date));

  const { data: generations } = await supabase
    .from("team_generations")
    .select("id, event_id, generated_at")
    .in("event_id", eventIds)
    .order("generated_at", { ascending: false });

  const latestGenIdByEvent = new Map<string, string>();
  for (const g of generations ?? []) {
    if (!latestGenIdByEvent.has(g.event_id)) latestGenIdByEvent.set(g.event_id, g.id);
  }
  const genIds = [...latestGenIdByEvent.values()];
  if (!genIds.length) return entries;

  const { data: teamRows } = await supabase.from("teams").select("id, generation_id").in("generation_id", genIds);
  const teamIds = (teamRows ?? []).map((t) => t.id);
  const genIdByTeam = new Map((teamRows ?? []).map((t) => [t.id, t.generation_id]));
  const eventIdByGenId = new Map((generations ?? []).map((g) => [g.id, g.event_id]));

  const { data: memberRows } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("profile_id", profileId)
    .in("team_id", teamIds);

  const myTeamIdByEvent = new Map<string, string>();
  for (const m of memberRows ?? []) {
    const genId = genIdByTeam.get(m.team_id);
    const eventId = genId ? eventIdByGenId.get(genId) : undefined;
    if (eventId) myTeamIdByEvent.set(eventId, m.team_id);
  }

  const { data: winRows } = await supabase.from("match_wins").select("event_id, team_id").in("event_id", eventIds);
  const winsByEvent = new Map<string, number>();
  for (const w of winRows ?? []) {
    if (myTeamIdByEvent.get(w.event_id) !== w.team_id) continue;
    winsByEvent.set(w.event_id, (winsByEvent.get(w.event_id) ?? 0) + 1);
  }

  for (const entry of entries) {
    entry.teamWins = winsByEvent.get(entry.eventId) ?? 0;
  }

  return entries;
}
