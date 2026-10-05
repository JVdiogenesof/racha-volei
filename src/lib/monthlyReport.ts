import type { SupabaseClient } from "@supabase/supabase-js";
import type { Community } from "@/lib/community";
import { getPresentProfileIdsByEvent } from "@/lib/presence";

export const MONTHLY_REPORT_REQUIRED_EVENTS = 4;

export type MonthlyReportMetric = "performance" | "wins" | "mvp" | "attendance";

export type MonthlyReportPlayer = {
  profileId: string;
  fullName: string;
  avatarUrl: string | null;
  attendance: number;
  wins: number;
  mvp: number;
  performanceWins: number;
  matches: number;
  losses: number;
  percentage: number | null;
};

export type MonthlyReport = {
  community: Community;
  monthKey: string;
  monthLabel: string;
  unlocked: boolean;
  finishedEvents: { id: string; date: string }[];
  requiredEvents: number;
  totalParticipations: number;
  totalMatches: number;
  averageAttendance: number;
  players: MonthlyReportPlayer[];
  rankings: Record<MonthlyReportMetric, MonthlyReportPlayer[]>;
};

export function currentMonthKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "America/Fortaleza",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  return `${year}-${month}`;
}

export function normalizeMonthKey(value: string | null | undefined, fallback = currentMonthKey()) {
  if (!value || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return fallback;
  return value;
}

export function monthRange(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextStart = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
  return { start, nextStart };
}

export function formatMonthLabel(monthKey: string) {
  return new Date(`${monthKey}-01T12:00:00`).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
}

export async function getMonthlyReport(
  supabase: SupabaseClient,
  community: Community,
  requestedMonth: string,
): Promise<MonthlyReport> {
  const monthKey = normalizeMonthKey(requestedMonth);
  const { start, nextStart } = monthRange(monthKey);
  const { data: eventRows, error: eventError } = await supabase
    .from("events")
    .select("id, date, status, is_pre_torneio, mvp_profile_id, mvp_profile_id_2")
    .eq("community", community)
    .gte("date", start)
    .lt("date", nextStart)
    .order("date", { ascending: true });
  if (eventError) throw new Error(eventError.message);

  const finishedEvents = (eventRows ?? []).filter((event) => event.status === "finished");
  const finishedEventIds = finishedEvents.map((event) => event.id);
  const unlocked = finishedEvents.length >= MONTHLY_REPORT_REQUIRED_EVENTS;
  const emptyReport: MonthlyReport = {
    community,
    monthKey,
    monthLabel: formatMonthLabel(monthKey),
    unlocked,
    finishedEvents: finishedEvents.map(({ id, date }) => ({ id, date })),
    requiredEvents: MONTHLY_REPORT_REQUIRED_EVENTS,
    totalParticipations: 0,
    totalMatches: 0,
    averageAttendance: 0,
    players: [],
    rankings: { performance: [], wins: [], mvp: [], attendance: [] },
  };
  if (!finishedEventIds.length) return emptyReport;

  const [presentByEvent, { data: matchRows, error: matchError }] = await Promise.all([
    getPresentProfileIdsByEvent(supabase, finishedEventIds),
    supabase
      .from("match_wins")
      .select("event_id, team_id, loser_team_id, winning_profile_ids, losing_profile_ids")
      .in("event_id", finishedEventIds),
  ]);
  if (matchError) throw new Error(matchError.message);

  const allTeamIds = [
    ...new Set(
      (matchRows ?? []).flatMap((row) => [row.team_id, row.loser_team_id].filter((id): id is string => Boolean(id))),
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

  type MutableStats = Omit<MonthlyReportPlayer, "fullName" | "avatarUrl" | "percentage"> & {
    percentage: number | null;
  };
  const statsByProfile = new Map<string, MutableStats>();
  const statsFor = (profileId: string) => {
    const current = statsByProfile.get(profileId) ?? {
      profileId,
      attendance: 0,
      wins: 0,
      mvp: 0,
      performanceWins: 0,
      matches: 0,
      losses: 0,
      percentage: null,
    };
    statsByProfile.set(profileId, current);
    return current;
  };

  for (const profileIds of presentByEvent.values()) {
    for (const profileId of profileIds) statsFor(profileId).attendance += 1;
  }

  for (const event of finishedEvents) {
    for (const profileId of [event.mvp_profile_id, event.mvp_profile_id_2]) {
      if (profileId) statsFor(profileId).mvp += 1;
    }
  }

  const preTournamentByEvent = new Map(finishedEvents.map((event) => [event.id, event.is_pre_torneio]));
  for (const match of matchRows ?? []) {
    const winnerIds = match.winning_profile_ids?.length
      ? match.winning_profile_ids
      : profileIdsByTeam.get(match.team_id) ?? [];
    const loserIds = match.losing_profile_ids?.length
      ? match.losing_profile_ids
      : match.loser_team_id
        ? profileIdsByTeam.get(match.loser_team_id) ?? []
        : [];

    for (const profileId of winnerIds) statsFor(profileId).wins += 1;
    if (preTournamentByEvent.get(match.event_id) || !match.loser_team_id) continue;
    for (const profileId of winnerIds) {
      const stats = statsFor(profileId);
      stats.matches += 1;
      stats.performanceWins += 1;
    }
    for (const profileId of loserIds) {
      const stats = statsFor(profileId);
      stats.matches += 1;
      stats.losses += 1;
    }
  }

  const profileIds = [...statsByProfile.keys()];
  const { data: profileRows, error: profileError } = profileIds.length
    ? await supabase.from("profiles").select("id, full_name, avatar_url").in("id", profileIds)
    : { data: [], error: null };
  if (profileError) throw new Error(profileError.message);
  const profileById = new Map((profileRows ?? []).map((profile) => [profile.id, profile]));

  const players = [...statsByProfile.values()]
    .flatMap((stats) => {
      const profile = profileById.get(stats.profileId);
      if (!profile) return [];
      return [{
        ...stats,
        fullName: profile.full_name,
        avatarUrl: profile.avatar_url,
        percentage: stats.matches ? Math.round((stats.performanceWins / stats.matches) * 100) : null,
      } satisfies MonthlyReportPlayer];
    })
    .sort((a, b) => a.fullName.localeCompare(b.fullName, "pt-BR"));

  const byName = (a: MonthlyReportPlayer, b: MonthlyReportPlayer) => a.fullName.localeCompare(b.fullName, "pt-BR");
  const rankings: MonthlyReport["rankings"] = {
    performance: [...players].sort((a, b) =>
      (b.percentage ?? -1) - (a.percentage ?? -1) || b.wins - a.wins || b.matches - a.matches || byName(a, b)),
    wins: [...players].sort((a, b) => b.wins - a.wins || (b.percentage ?? -1) - (a.percentage ?? -1) || byName(a, b)),
    mvp: [...players].sort((a, b) => b.mvp - a.mvp || b.attendance - a.attendance || byName(a, b)),
    attendance: [...players].sort((a, b) => b.attendance - a.attendance || b.wins - a.wins || byName(a, b)),
  };
  const totalParticipations = players.reduce((sum, player) => sum + player.attendance, 0);

  return {
    ...emptyReport,
    totalParticipations,
    totalMatches: matchRows?.length ?? 0,
    averageAttendance: finishedEvents.length ? totalParticipations / finishedEvents.length : 0,
    players,
    rankings,
  };
}
