import type { SupabaseClient } from "@supabase/supabase-js";

export type EventSummaryPlayer = {
  profileId: string;
  fullName: string;
  avatarUrl: string | null;
  teamNumber: number;
  wins: number;
};

export type EventSummary = {
  event: {
    id: string;
    date: string;
    location: string | null;
    status: string;
    isPreTournament: boolean;
  };
  players: EventSummaryPlayer[];
  totalMatches: number;
  bestWinCount: number;
};

export async function getEventSummary(
  supabase: SupabaseClient,
  eventId: string,
): Promise<EventSummary | null> {
  const [{ data: event, error: eventError }, { data: generation, error: generationError }] =
    await Promise.all([
      supabase
        .from("events")
        .select("id, date, location, status, is_pre_torneio")
        .eq("id", eventId)
        .maybeSingle(),
      supabase
        .from("team_generations")
        .select("id")
        .eq("event_id", eventId)
        .order("generated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  if (eventError) throw new Error(eventError.message);
  if (generationError) throw new Error(generationError.message);
  if (!event) return null;

  if (!generation) {
    return {
      event: {
        id: event.id,
        date: event.date,
        location: event.location,
        status: event.status,
        isPreTournament: event.is_pre_torneio,
      },
      players: [],
      totalMatches: 0,
      bestWinCount: 0,
    };
  }

  const { data: teamRows, error: teamError } = await supabase
    .from("teams")
    .select("id, team_number")
    .eq("generation_id", generation.id)
    .order("team_number");
  if (teamError) throw new Error(teamError.message);

  const teamIds = (teamRows ?? []).map((team) => team.id);
  if (!teamIds.length) {
    return {
      event: {
        id: event.id,
        date: event.date,
        location: event.location,
        status: event.status,
        isPreTournament: event.is_pre_torneio,
      },
      players: [],
      totalMatches: 0,
      bestWinCount: 0,
    };
  }

  const [{ data: memberRows, error: memberError }, { data: winRows, error: winError }] =
    await Promise.all([
      supabase
        .from("team_members")
        .select("team_id, profile_id, profiles(full_name, avatar_url)")
        .in("team_id", teamIds),
      supabase.from("match_wins").select("team_id").eq("event_id", eventId).in("team_id", teamIds),
    ]);

  if (memberError) throw new Error(memberError.message);
  if (winError) throw new Error(winError.message);

  const teamNumberById = new Map((teamRows ?? []).map((team) => [team.id, team.team_number]));
  const winsByTeam = new Map<string, number>();
  for (const win of winRows ?? []) {
    winsByTeam.set(win.team_id, (winsByTeam.get(win.team_id) ?? 0) + 1);
  }

  const players = (memberRows ?? [])
    .map((member) => {
      const profile = member.profiles as unknown as {
        full_name: string;
        avatar_url: string | null;
      } | null;
      return {
        profileId: member.profile_id,
        fullName: profile?.full_name ?? "Jogador",
        avatarUrl: profile?.avatar_url ?? null,
        teamNumber: teamNumberById.get(member.team_id) ?? 0,
        wins: winsByTeam.get(member.team_id) ?? 0,
      };
    })
    .sort((a, b) => b.wins - a.wins || a.fullName.localeCompare(b.fullName, "pt-BR"));

  return {
    event: {
      id: event.id,
      date: event.date,
      location: event.location,
      status: event.status,
      isPreTournament: event.is_pre_torneio,
    },
    players,
    totalMatches: winRows?.length ?? 0,
    bestWinCount: players[0]?.wins ?? 0,
  };
}
