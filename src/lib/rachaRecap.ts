import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Community } from "@/lib/community";
import { computeStandings } from "@/lib/torneioStandings";
import { getSeasonRanking } from "@/lib/seasonRanking";

/**
 * Tudo de um racha numa consulta só, para a tela "Como foi o racha": times,
 * jogos com placar, campeão (ou time que mais venceu), pódio do mini torneio,
 * Jogadores Destaque e, se for o racha mais recente, quem mais subiu e caiu
 * no Índice VPA.
 */

export type RecapPlayer = { profileId: string; fullName: string; avatarUrl: string | null; avatarFrame: string | null; isSetter: boolean };
export type RecapTeam = {
  id: string;
  number: number;
  name: string;
  members: RecapPlayer[];
  played: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
};
export type RecapMatch = {
  id: string;
  stage: "group" | "third_place" | "final" | "match";
  teamAId: string;
  teamBId: string;
  scoreA: number | null;
  scoreB: number | null;
  /** Em racha normal o placar pode não ter sido lançado: só se sabe quem venceu. */
  winnerId: string | null;
};
export type RecapMove = { profileId: string; fullName: string; avatarUrl: string | null; avatarFrame: string | null; position: number; change: number; points: number | null };

export type RachaRecap = {
  event: {
    id: string;
    date: string;
    time: string | null;
    location: string | null;
    status: string;
    community: Community;
    isPreTournament: boolean;
    isMiniTournament: boolean;
  };
  isTournament: boolean;
  teams: RecapTeam[];
  matches: RecapMatch[];
  /** Mini torneio: campeão da final. Racha normal: o(s) time(s) com mais vitórias. */
  champions: RecapTeam[];
  finalMatch: RecapMatch | null;
  /** 1º ao 4º do mini torneio / pré-torneio (vazio em racha normal). */
  placements: { place: number; team: RecapTeam }[];
  mvps: RecapPlayer[];
  /** Só no racha mais recente: o Índice ainda reflete exatamente este racha. */
  moves: { up: RecapMove[]; down: RecapMove[] } | null;
  playerCount: number;
};

type ProfileRow = { full_name: string; avatar_url: string | null; avatar_frame: string | null } | null;

export async function getRachaRecap(supabase: SupabaseClient, eventId: string): Promise<RachaRecap | null> {
  const [{ data: event }, { data: generation }, { data: setterRows }] = await Promise.all([
    supabase
      .from("events")
      .select("id, date, time, location, status, community, is_pre_torneio, is_mini_torneio, mvp_profile_id, mvp_profile_id_2")
      .eq("id", eventId)
      .maybeSingle(),
    supabase.from("team_generations").select("id").eq("event_id", eventId).order("generated_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("attendance").select("profile_id").eq("event_id", eventId).eq("uses_setter_spot", true),
  ]);
  if (!event) return null;
  const isTournament = Boolean(event.is_pre_torneio || event.is_mini_torneio);
  const setters = new Set((setterRows ?? []).map((row) => row.profile_id as string));

  const { data: teamRows } = generation
    ? await supabase.from("teams").select("id, team_number, name").eq("generation_id", generation.id).order("team_number")
    : { data: [] as { id: string; team_number: number; name: string }[] };
  const teamIds = (teamRows ?? []).map((team) => team.id);

  const mvpIds = [event.mvp_profile_id, event.mvp_profile_id_2].filter((id): id is string => Boolean(id));
  const [{ data: memberRows }, { data: tournamentRows }, { data: winRows }, { data: mvpRows }] = await Promise.all([
    teamIds.length
      ? supabase.from("team_members").select("team_id, profile_id, profiles(full_name, avatar_url, avatar_frame)").in("team_id", teamIds)
      : Promise.resolve({ data: [] as { team_id: string; profile_id: string; profiles: unknown }[] }),
    isTournament
      ? supabase.from("tournament_matches").select("id, stage, team_a_id, team_b_id, score_a, score_b, played_at").eq("event_id", eventId)
      : Promise.resolve({ data: [] as { id: string; stage: string; team_a_id: string; team_b_id: string; score_a: number | null; score_b: number | null; played_at: string | null }[] }),
    !isTournament
      ? supabase.from("match_wins").select("id, team_id, loser_team_id, winner_score, loser_score, recorded_at").eq("event_id", eventId).order("recorded_at")
      : Promise.resolve({ data: [] as { id: string; team_id: string; loser_team_id: string | null; winner_score: number | null; loser_score: number | null; recorded_at: string }[] }),
    mvpIds.length
      ? supabase.from("profiles").select("id, full_name, avatar_url, avatar_frame").in("id", mvpIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string; avatar_url: string | null; avatar_frame: string | null }[] }),
  ]);

  const teams: RecapTeam[] = (teamRows ?? []).map((team) => ({
    id: team.id,
    number: team.team_number,
    name: team.name,
    members: (memberRows ?? [])
      .filter((member) => member.team_id === team.id)
      .map((member) => {
        const profile = member.profiles as unknown as ProfileRow;
        return {
          profileId: member.profile_id,
          fullName: profile?.full_name ?? "Jogador",
          avatarUrl: profile?.avatar_url ?? null,
          avatarFrame: profile?.avatar_frame ?? null,
          isSetter: setters.has(member.profile_id),
        };
      })
      .sort((a, b) => Number(b.isSetter) - Number(a.isSetter) || a.fullName.localeCompare(b.fullName, "pt-BR")),
    played: 0,
    wins: 0,
    losses: 0,
    pointsFor: 0,
    pointsAgainst: 0,
  }));
  const teamById = new Map(teams.map((team) => [team.id, team]));

  const STAGE_ORDER = { group: 0, third_place: 1, final: 2 } as Record<string, number>;
  const matches: RecapMatch[] = isTournament
    ? (tournamentRows ?? [])
        .slice()
        .sort((a, b) => (STAGE_ORDER[a.stage] ?? 0) - (STAGE_ORDER[b.stage] ?? 0) || (a.played_at ?? "").localeCompare(b.played_at ?? ""))
        .map((row) => ({
          id: row.id,
          stage: row.stage as RecapMatch["stage"],
          teamAId: row.team_a_id,
          teamBId: row.team_b_id,
          scoreA: row.score_a,
          scoreB: row.score_b,
          winnerId: row.score_a != null && row.score_b != null && row.score_a !== row.score_b ? (row.score_a > row.score_b ? row.team_a_id : row.team_b_id) : null,
        }))
    : (winRows ?? [])
        .filter((row) => row.loser_team_id)
        .map((row) => ({
          id: row.id,
          stage: "match" as const,
          teamAId: row.team_id,
          teamBId: row.loser_team_id!,
          scoreA: row.winner_score,
          scoreB: row.loser_score,
          winnerId: row.team_id,
        }));

  // Campanha de cada time no dia (todas as partidas, inclusive final e 3º lugar).
  for (const match of matches) {
    const a = teamById.get(match.teamAId);
    const b = teamById.get(match.teamBId);
    if (!a || !b || !match.winnerId) continue;
    a.played += 1;
    b.played += 1;
    if (match.scoreA != null && match.scoreB != null) {
      a.pointsFor += match.scoreA;
      a.pointsAgainst += match.scoreB;
      b.pointsFor += match.scoreB;
      b.pointsAgainst += match.scoreA;
    }
    const winner = match.winnerId === a.id ? a : b;
    const loser = winner === a ? b : a;
    winner.wins += 1;
    loser.losses += 1;
  }
  // Racha normal antigo: vitórias lançadas sem o time perdedor ainda contam pro time.
  if (!isTournament) {
    for (const row of winRows ?? []) {
      if (row.loser_team_id) continue;
      const team = teamById.get(row.team_id);
      if (team) {
        team.wins += 1;
        team.played += 1;
      }
    }
  }

  const finalMatch = matches.find((match) => match.stage === "final") ?? null;
  let champions: RecapTeam[] = [];
  const placements: { place: number; team: RecapTeam }[] = [];
  if (isTournament) {
    if (finalMatch?.winnerId) {
      const champion = teamById.get(finalMatch.winnerId)!;
      const runnerUp = teamById.get(finalMatch.winnerId === finalMatch.teamAId ? finalMatch.teamBId : finalMatch.teamAId);
      champions = [champion];
      const third = matches.find((match) => match.stage === "third_place");
      const standings = computeStandings(
        teams.map((team) => ({ id: team.id, teamNumber: team.number, name: team.name })),
        matches.filter((match) => match.stage === "group").map((match) => ({ teamAId: match.teamAId, teamBId: match.teamBId, scoreA: match.scoreA, scoreB: match.scoreB })),
      );
      const thirdId = third?.winnerId ?? standings[2]?.teamId;
      const fourthId = third?.winnerId ? (third.winnerId === third.teamAId ? third.teamBId : third.teamAId) : standings[3]?.teamId;
      [champion, runnerUp, thirdId ? teamById.get(thirdId) : undefined, fourthId ? teamById.get(fourthId) : undefined].forEach((team, index) => {
        if (team) placements.push({ place: index + 1, team });
      });
    }
  } else if (teams.some((team) => team.wins > 0)) {
    const balance = (team: RecapTeam) => team.pointsFor - team.pointsAgainst;
    const best = Math.max(...teams.map((team) => team.wins));
    const leaders = teams.filter((team) => team.wins === best);
    const bestBalance = Math.max(...leaders.map(balance));
    champions = leaders.filter((team) => balance(team) === bestBalance);
  }

  const mvps: RecapPlayer[] = mvpIds
    .map((id) => (mvpRows ?? []).find((row) => row.id === id))
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .map((row) => ({ profileId: row.id, fullName: row.full_name, avatarUrl: row.avatar_url, avatarFrame: row.avatar_frame, isSetter: setters.has(row.id) }));

  const moves = event.status === "finished" ? await getIndexMoves(supabase, event.community as Community, event.id) : null;

  return {
    event: {
      id: event.id,
      date: event.date,
      time: event.time,
      location: event.location,
      status: event.status,
      community: event.community as Community,
      isPreTournament: Boolean(event.is_pre_torneio),
      isMiniTournament: Boolean(event.is_mini_torneio),
    },
    isTournament,
    teams,
    matches,
    champions,
    finalMatch,
    placements,
    mvps,
    moves,
    playerCount: teams.reduce((sum, team) => sum + team.members.length, 0),
  };
}

/** Quem mais subiu e caiu no Índice, só se este é o racha encerrado mais recente (é o que as setas do ranking medem). */
async function getIndexMoves(supabase: SupabaseClient, community: Community, eventId: string) {
  const { data: latest } = await supabase
    .from("events")
    .select("id")
    .eq("community", community)
    .eq("status", "finished")
    .order("date", { ascending: false })
    .order("time", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  if (latest?.id !== eventId) return null;

  const [season, { data: profiles }] = await Promise.all([
    getSeasonRanking(supabase, community),
    supabase.from("profiles").select("id, full_name, avatar_url, avatar_frame").eq("status", "approved").contains("communities", [community]),
  ]);
  const byId = new Map((profiles ?? []).map((profile) => [profile.id as string, profile]));
  // Mesma ordem da tela de ranking: quem está no índice, por pontos.
  const ranked = [...season.values()]
    .filter((score) => score.eligible && byId.has(score.profileId))
    .sort((a, b) => b.averageIndex - a.averageIndex || b.totalWins - a.totalWins);
  const rows: RecapMove[] = ranked
    .map((score, index) => {
      const profile = byId.get(score.profileId)!;
      return {
        profileId: score.profileId,
        fullName: profile.full_name as string,
        avatarUrl: (profile.avatar_url as string | null) ?? null,
        avatarFrame: (profile.avatar_frame as string | null) ?? null,
        position: index + 1,
        change: score.positionChange ?? 0,
        points: score.indexChange,
      };
    })
    .filter((row) => row.change !== 0);
  const up = rows.filter((row) => row.change > 0).sort((a, b) => b.change - a.change || (b.points ?? 0) - (a.points ?? 0)).slice(0, 3);
  const down = rows.filter((row) => row.change < 0).sort((a, b) => a.change - b.change || (a.points ?? 0) - (b.points ?? 0)).slice(0, 3);
  return up.length || down.length ? { up, down } : null;
}
