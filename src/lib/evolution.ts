import type { SupabaseClient } from "@supabase/supabase-js";
import type { Community } from "./community";
import { getPresentProfileIdsByEvent } from "./presence";

export type EvolutionStatus = "confirmed" | "interested" | "declined" | "participated";

export type EvolutionEntry = {
  eventId: string;
  date: string;
  location: string | null;
  status: EvolutionStatus;
  isPreTournament: boolean;
  wasPresent: boolean;
  wasDestaque: boolean;
  wins: number;
  performanceWins: number;
  losses: number;
  matches: number;
  percentage: number | null;
};

export type EvolutionMonth = {
  monthKey: string;
  monthLabel: string;
  attendance: number;
  wins: number;
  performanceWins: number;
  losses: number;
  matches: number;
  percentage: number | null;
};

export type EvolutionConnection = {
  profileId: string;
  fullName: string;
  avatarUrl: string | null;
  confrontations: number;
  events: number;
};

export type PersonalEvolution = {
  entries: EvolutionEntry[];
  months: EvolutionMonth[];
  teammates: EvolutionConnection[];
  opponents: EvolutionConnection[];
  totals: {
    attendance: number;
    highlights: number;
    wins: number;
    performanceWins: number;
    losses: number;
    matches: number;
    percentage: number | null;
  };
};

type ResultStats = {
  wins: number;
  performanceWins: number;
  losses: number;
  matches: number;
};

type ConnectionCounter = { confrontations: number; eventIds: Set<string> };

const EMPTY_RESULT = (): ResultStats => ({ wins: 0, performanceWins: 0, losses: 0, matches: 0 });
const IMPOSSIBLE_ID = "00000000-0000-0000-0000-000000000000";

function addConnection(map: Map<string, ConnectionCounter>, profileId: string, eventId: string) {
  const current = map.get(profileId) ?? { confrontations: 0, eventIds: new Set<string>() };
  current.confrontations += 1;
  current.eventIds.add(eventId);
  map.set(profileId, current);
}

function formatMonthLabel(monthKey: string) {
  const label = new Date(`${monthKey}-01T12:00:00`).toLocaleDateString("pt-BR", {
    month: "short",
    year: "2-digit",
  });
  return label.replace(" de ", "/").replace(".", "");
}

/**
 * Monta o histórico pessoal usando apenas dados que o app já registra.
 * Presença segue a mesma regra do ranking. Vitórias incluem todo tipo de
 * racha; derrotas e aproveitamento seguem o ranking e consideram somente os
 * confrontos normais que possuem vencedor e perdedor registrados.
 */
export async function getPersonalEvolution(
  supabase: SupabaseClient,
  profileId: string,
  community: Community = "court",
): Promise<PersonalEvolution> {
  const [{ data: eventRows, error: eventError }, { data: attendanceRows, error: attendanceError }] = await Promise.all([
    supabase
      .from("events")
      .select("id, date, location, status, is_pre_torneio, mvp_profile_id, mvp_profile_id_2")
      .eq("community", community)
      .order("date", { ascending: false }),
    supabase.from("attendance").select("event_id, status").eq("profile_id", profileId),
  ]);
  if (eventError) throw new Error(eventError.message);
  if (attendanceError) throw new Error(attendanceError.message);

  const events = eventRows ?? [];
  const eventIds = events.map((event) => event.id);
  const finishedEvents = events.filter((event) => event.status === "finished");
  const finishedEventIds = finishedEvents.map((event) => event.id);
  const eventById = new Map(events.map((event) => [event.id, event]));
  const attendanceByEvent = new Map(
    (attendanceRows ?? []).map((row) => [row.event_id, row.status as Exclude<EvolutionStatus, "participated">]),
  );

  const [presentByEvent, { data: matchRows, error: matchError }] = await Promise.all([
    getPresentProfileIdsByEvent(supabase, finishedEventIds),
    supabase
      .from("match_wins")
      .select("event_id, team_id, loser_team_id, winning_profile_ids, losing_profile_ids")
      .in("event_id", eventIds.length ? eventIds : [IMPOSSIBLE_ID]),
  ]);
  if (matchError) throw new Error(matchError.message);

  const allTeamIds = [
    ...new Set(
      (matchRows ?? []).flatMap((row) =>
        [row.team_id, row.loser_team_id].filter((teamId): teamId is string => Boolean(teamId)),
      ),
    ),
  ];
  const { data: memberRows, error: memberError } = allTeamIds.length
    ? await supabase.from("team_members").select("team_id, profile_id").in("team_id", allTeamIds)
    : { data: [], error: null };
  if (memberError) throw new Error(memberError.message);

  const profileIdsByTeam = new Map<string, string[]>();
  for (const member of memberRows ?? []) {
    const ids = profileIdsByTeam.get(member.team_id) ?? [];
    ids.push(member.profile_id);
    profileIdsByTeam.set(member.team_id, ids);
  }

  const resultsByEvent = new Map<string, ResultStats>();
  const teammateCounts = new Map<string, ConnectionCounter>();
  const opponentCounts = new Map<string, ConnectionCounter>();
  const involvedEventIds = new Set<string>();

  for (const match of matchRows ?? []) {
    const event = eventById.get(match.event_id);
    if (!event || event.status !== "finished") continue;

    const winnerIds: string[] = match.winning_profile_ids?.length
      ? match.winning_profile_ids
      : profileIdsByTeam.get(match.team_id) ?? [];
    const loserIds: string[] = match.losing_profile_ids?.length
      ? match.losing_profile_ids
      : match.loser_team_id
        ? profileIdsByTeam.get(match.loser_team_id) ?? []
        : [];
    const playerWon = winnerIds.includes(profileId);
    const playerLost = loserIds.includes(profileId);
    if (!playerWon && !playerLost) continue;

    involvedEventIds.add(match.event_id);
    const result = resultsByEvent.get(match.event_id) ?? EMPTY_RESULT();
    if (playerWon) result.wins += 1;

    // Esta é exatamente a regra do ranking de aproveitamento atual.
    const isPairedNormalConfrontation = !event.is_pre_torneio && Boolean(match.loser_team_id);
    if (isPairedNormalConfrontation) {
      result.matches += 1;
      if (playerWon) result.performanceWins += 1;
      if (playerLost) result.losses += 1;

      const teammates = playerWon ? winnerIds : loserIds;
      const opponents = playerWon ? loserIds : winnerIds;
      for (const teammateId of new Set(teammates)) {
        if (teammateId !== profileId) addConnection(teammateCounts, teammateId, match.event_id);
      }
      for (const opponentId of new Set(opponents)) {
        if (opponentId !== profileId) addConnection(opponentCounts, opponentId, match.event_id);
      }
    }
    resultsByEvent.set(match.event_id, result);
  }

  const relevantEventIds = new Set<string>();
  for (const eventId of attendanceByEvent.keys()) {
    if (eventById.has(eventId)) relevantEventIds.add(eventId);
  }
  for (const [eventId, profileIds] of presentByEvent) {
    if (profileIds.has(profileId)) relevantEventIds.add(eventId);
  }
  for (const eventId of involvedEventIds) relevantEventIds.add(eventId);

  const entries = [...relevantEventIds]
    .flatMap((eventId) => {
      const event = eventById.get(eventId);
      if (!event) return [];
      const result = resultsByEvent.get(eventId) ?? EMPTY_RESULT();
      const wasPresent = presentByEvent.get(eventId)?.has(profileId) ?? involvedEventIds.has(eventId);
      return [{
        eventId,
        date: event.date,
        location: event.location,
        status: attendanceByEvent.get(eventId) ?? "participated",
        isPreTournament: event.is_pre_torneio,
        wasPresent,
        wasDestaque: event.mvp_profile_id === profileId || event.mvp_profile_id_2 === profileId,
        ...result,
        percentage: result.matches ? Math.round((result.performanceWins / result.matches) * 100) : null,
      } satisfies EvolutionEntry];
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  const finishedEntries = entries.filter((entry) => eventById.get(entry.eventId)?.status === "finished");
  const totals = finishedEntries.reduce(
    (total, entry) => {
      if (entry.wasPresent) total.attendance += 1;
      if (entry.wasDestaque) total.highlights += 1;
      total.wins += entry.wins;
      total.performanceWins += entry.performanceWins;
      total.losses += entry.losses;
      total.matches += entry.matches;
      return total;
    },
    { attendance: 0, highlights: 0, wins: 0, performanceWins: 0, losses: 0, matches: 0, percentage: null as number | null },
  );
  totals.percentage = totals.matches ? Math.round((totals.performanceWins / totals.matches) * 100) : null;

  const monthsByKey = new Map<string, Omit<EvolutionMonth, "monthLabel" | "percentage">>();
  for (const entry of finishedEntries) {
    if (!entry.wasPresent && !entry.wins && !entry.matches && !entry.wasDestaque) continue;
    const monthKey = entry.date.slice(0, 7);
    const month = monthsByKey.get(monthKey) ?? {
      monthKey,
      attendance: 0,
      wins: 0,
      performanceWins: 0,
      losses: 0,
      matches: 0,
    };
    if (entry.wasPresent) month.attendance += 1;
    month.wins += entry.wins;
    month.performanceWins += entry.performanceWins;
    month.losses += entry.losses;
    month.matches += entry.matches;
    monthsByKey.set(monthKey, month);
  }
  const months = [...monthsByKey.values()]
    .map((month) => ({
      ...month,
      monthLabel: formatMonthLabel(month.monthKey),
      percentage: month.matches ? Math.round((month.performanceWins / month.matches) * 100) : null,
    }))
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey));

  const connectionIds = [...new Set([...teammateCounts.keys(), ...opponentCounts.keys()])];
  const { data: profileRows, error: profileError } = connectionIds.length
    ? await supabase.from("profiles").select("id, full_name, avatar_url").in("id", connectionIds)
    : { data: [], error: null };
  if (profileError) throw new Error(profileError.message);
  const profileById = new Map((profileRows ?? []).map((profile) => [profile.id, profile]));

  const makeConnections = (counts: Map<string, ConnectionCounter>) =>
    [...counts.entries()]
      .flatMap(([connectionProfileId, count]) => {
        const connectionProfile = profileById.get(connectionProfileId);
        if (!connectionProfile) return [];
        return [{
          profileId: connectionProfileId,
          fullName: connectionProfile.full_name,
          avatarUrl: connectionProfile.avatar_url,
          confrontations: count.confrontations,
          events: count.eventIds.size,
        } satisfies EvolutionConnection];
      })
      .sort((a, b) => b.confrontations - a.confrontations || b.events - a.events || a.fullName.localeCompare(b.fullName, "pt-BR"));

  return {
    entries,
    months,
    teammates: makeConnections(teammateCounts),
    opponents: makeConnections(opponentCounts),
    totals,
  };
}
