import type { SupabaseClient } from "@supabase/supabase-js";
import type { Community } from "./community";
import { getPresentProfileIdsByEvent } from "./presence";
import { INDEX_BASE_PERCENTAGE, INDEX_CONFIDENCE_MATCHES } from "./rankings";

// A temporada continua sendo usada como referência do torneio oficial. O
// Índice em si é uma janela viva: os oito últimos rachas deixam a tabela
// responder à fase atual de cada jogador, sem apagar completamente a história.
export const SEASON_START_MONTH = "2026-09";
export const ROLLING_INDEX_EVENT_COUNT = 8;
export const INDEX_MIN_EVENTS = 2;
const RECENT_EVENT_COUNT = 4;
const RECENT_EVENT_WEIGHT = 2.5;
const OLDER_EVENT_WEIGHT = 1;
const MAX_PROGRESS_BONUS = 5;
// Peso de cada parte do Índice: aproveitamento, presença e saldo de pontos.
export const INDEX_PERFORMANCE_WEIGHT = 0.55;
export const INDEX_ATTENDANCE_WEIGHT = 0.35;
export const INDEX_POINT_BALANCE_WEIGHT = 0.1;
// A margem de um jogo é (pontos feitos - sofridos) / pontos totais da partida,
// então jogos de tamanhos diferentes (grupo x final) ficam comparáveis. O teto
// evita que uma lavada isolada pese muito mais que uma vitória folgada.
const MARGIN_CAP = 0.5;

export type RankingTrend = "up" | "down" | "same" | "new";

export type SeasonPlayerScore = {
  profileId: string;
  eventsPlayed: number;
  averageIndex: number;
  totalWins: number;
  totalLosses: number;
  totalAttendance: number;
  progressBonus: number;
  trend: RankingTrend;
  positionChange: number | null;
  // Saldo em pontos reais das partidas com placar dentro da janela do Índice.
  pointsFor: number;
  pointsAgainst: number;
  pointsDiff: number;
  eligible: boolean;
};

type EventRow = { id: string; date: string; is_pre_torneio: boolean };
type EventPlayerRecord = { present: boolean; wins: number; losses: number; marginSum: number; marginGames: number; pointsFor: number; pointsAgainst: number };
type ScoreDraft = Omit<SeasonPlayerScore, "trend" | "positionChange">;

export { formatPointsDiff } from "./pointsDiff";

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}

function recordFor(records: Map<string, Map<string, EventPlayerRecord>>, eventId: string, profileId: string) {
  const byProfile = records.get(eventId) ?? new Map<string, EventPlayerRecord>();
  records.set(eventId, byProfile);
  const record = byProfile.get(profileId) ?? { present: false, wins: 0, losses: 0, marginSum: 0, marginGames: 0, pointsFor: 0, pointsAgainst: 0 };
  byProfile.set(profileId, record);
  return record;
}

function adjustedForm(events: EventRow[], records: Map<string, Map<string, EventPlayerRecord>>, profileId: string) {
  let wins = 0;
  let matches = 0;
  for (const event of events) {
    const record = records.get(event.id)?.get(profileId);
    if (!record) continue;
    wins += record.wins;
    matches += record.wins + record.losses;
  }
  if (!matches) return null;
  const percentage = (wins / matches) * 100;
  const confidence = matches / (matches + INDEX_CONFIDENCE_MATCHES);
  return confidence * percentage + (1 - confidence) * INDEX_BASE_PERCENTAGE;
}

function buildScores(events: EventRow[], records: Map<string, Map<string, EventPlayerRecord>>) {
  const playerIds = new Set<string>();
  for (const eventRecords of records.values()) {
    for (const profileId of eventRecords.keys()) playerIds.add(profileId);
  }

  const recentStart = Math.max(0, events.length - RECENT_EVENT_COUNT);
  const weights = events.map((_, index) => index >= recentStart ? RECENT_EVENT_WEIGHT : OLDER_EVENT_WEIGHT);
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0) || 1;
  const recentEvents = events.slice(recentStart);
  const olderEvents = events.slice(0, recentStart);
  const scores = new Map<string, ScoreDraft>();

  for (const profileId of playerIds) {
    let weightedWins = 0;
    let weightedMatches = 0;
    let rawMatches = 0;
    let totalWins = 0;
    let totalLosses = 0;
    let eventsPlayed = 0;
    let attendedWeight = 0;
    let weightedMargin = 0;
    let marginWeight = 0;
    let marginGames = 0;
    let pointsFor = 0;
    let pointsAgainst = 0;

    events.forEach((event, index) => {
      const record = records.get(event.id)?.get(profileId);
      if (!record) return;
      const weight = weights[index];
      if (record.present) {
        eventsPlayed += 1;
        attendedWeight += weight;
      }
      const matches = record.wins + record.losses;
      weightedWins += record.wins * weight;
      weightedMatches += matches * weight;
      rawMatches += matches;
      totalWins += record.wins;
      totalLosses += record.losses;
      weightedMargin += record.marginSum * weight;
      marginWeight += record.marginGames * weight;
      marginGames += record.marginGames;
      pointsFor += record.pointsFor;
      pointsAgainst += record.pointsAgainst;
    });

    const percentage = weightedMatches ? (weightedWins / weightedMatches) * 100 : INDEX_BASE_PERCENTAGE;
    const confidence = rawMatches / (rawMatches + INDEX_CONFIDENCE_MATCHES);
    const adjustedPerformance = confidence * percentage + (1 - confidence) * INDEX_BASE_PERCENTAGE;
    const attendancePercentage = (attendedWeight / totalWeight) * 100;
    // Saldo de pontos: margem média por jogo (só jogos com placar), de -50% a +50%
    // levada pra 0-100 e encolhida em direção a 50 enquanto há poucos jogos.
    const averageMargin = marginWeight ? weightedMargin / marginWeight : 0;
    const pointBalance = 50 + (averageMargin / MARGIN_CAP) * 50;
    const marginConfidence = marginGames / (marginGames + INDEX_CONFIDENCE_MATCHES);
    const adjustedPointBalance = marginConfidence * pointBalance + (1 - marginConfidence) * INDEX_BASE_PERCENTAGE;
    const baseIndex =
      adjustedPerformance * INDEX_PERFORMANCE_WEIGHT +
      attendancePercentage * INDEX_ATTENDANCE_WEIGHT +
      adjustedPointBalance * INDEX_POINT_BALANCE_WEIGHT;

    const recentAttendance = recentEvents.filter((event) => records.get(event.id)?.get(profileId)?.present).length;
    const olderAttendance = olderEvents.filter((event) => records.get(event.id)?.get(profileId)?.present).length;
    const recentForm = adjustedForm(recentEvents, records, profileId);
    const olderForm = adjustedForm(olderEvents, records, profileId);
    // Evolução só bonifica quem voltou a jogar e realmente melhorou a forma.
    const progressBonus = recentAttendance >= 2 && olderAttendance >= 1 && recentForm !== null && olderForm !== null
      ? Math.min(MAX_PROGRESS_BONUS, Math.max(0, roundOne((recentForm - olderForm) * 0.15)))
      : 0;

    scores.set(profileId, {
      profileId,
      eventsPlayed,
      totalAttendance: eventsPlayed,
      totalWins,
      totalLosses,
      pointsFor,
      pointsAgainst,
      pointsDiff: pointsFor - pointsAgainst,
      progressBonus,
      averageIndex: roundOne(Math.min(100, baseIndex + progressBonus)),
      eligible: eventsPlayed >= INDEX_MIN_EVENTS,
    });
  }

  return scores;
}

function positionsFor(scores: Map<string, ScoreDraft>) {
  const sorted = [...scores.values()]
    .filter((score) => score.eligible)
    .sort((a, b) => b.averageIndex - a.averageIndex || b.totalWins - a.totalWins || b.totalAttendance - a.totalAttendance || a.profileId.localeCompare(b.profileId));
  return new Map(sorted.map((score, index) => [score.profileId, index + 1]));
}

export async function getSeasonRanking(
  supabase: SupabaseClient,
  community: Community = "court",
): Promise<Map<string, SeasonPlayerScore>> {
  const { data: eventRows, error: eventError } = await supabase
    .from("events")
    .select("id, date, is_pre_torneio")
    .eq("community", community)
    .eq("status", "finished")
    .order("date", { ascending: false })
    .limit(ROLLING_INDEX_EVENT_COUNT);
  if (eventError) throw new Error(eventError.message);

  const events = ([...(eventRows ?? [])] as EventRow[]).reverse();
  if (!events.length) return new Map();
  const eventIds = events.map((event) => event.id);
  // Consultas independentes entre si (só dependem dos ids dos rachas): rodam juntas.
  const [presentByEvent, { data: matchRows, error: matchError }, { data: scoreRows, error: scoreError }, { data: adjustmentRows, error: adjustmentError }] = await Promise.all([
    getPresentProfileIdsByEvent(supabase, eventIds),
    supabase
      .from("match_wins")
      .select("event_id, match_id, team_id, loser_team_id, winning_profile_ids, losing_profile_ids")
      .in("event_id", eventIds),
    supabase
      .from("tournament_matches")
      .select("id, score_a, score_b")
      .in("event_id", eventIds)
      .not("score_a", "is", null)
      .not("score_b", "is", null),
    supabase
      .from("ranking_adjustments")
      .select("profile_id, metric, delta, event_id")
      .eq("community", community)
      .in("event_id", eventIds)
      .in("metric", ["wins", "losses", "attendance"]),
  ]);
  if (matchError) throw new Error(matchError.message);
  if (scoreError) throw new Error(scoreError.message);

  const teamIds = [...new Set((matchRows ?? []).flatMap((match) => [match.team_id, match.loser_team_id].filter((id): id is string => Boolean(id))))];
  const { data: memberRows, error: membersError } = teamIds.length
    ? await supabase.from("team_members").select("team_id, profile_id").in("team_id", teamIds)
    : { data: [], error: null };
  if (membersError) throw new Error(membersError.message);

  const profileIdsByTeam = new Map<string, string[]>();
  for (const member of memberRows ?? []) {
    const members = profileIdsByTeam.get(member.team_id) ?? [];
    members.push(member.profile_id);
    profileIdsByTeam.set(member.team_id, members);
  }

  const scoreByMatchId = new Map<string, { margin: number; winnerPoints: number; loserPoints: number }>();
  for (const row of scoreRows ?? []) {
    const total = row.score_a + row.score_b;
    if (total > 0) {
      scoreByMatchId.set(row.id, {
        margin: Math.abs(row.score_a - row.score_b) / total,
        winnerPoints: Math.max(row.score_a, row.score_b),
        loserPoints: Math.min(row.score_a, row.score_b),
      });
    }
  }

  const records = new Map<string, Map<string, EventPlayerRecord>>();
  for (const [eventId, presentProfiles] of presentByEvent) {
    for (const profileId of presentProfiles) recordFor(records, eventId, profileId).present = true;
  }

  for (const match of matchRows ?? []) {
    // Pré-torneios contam como um racha normal: presença e confrontos.
    if (!match.loser_team_id) continue;
    const winners = match.winning_profile_ids?.length ? match.winning_profile_ids : profileIdsByTeam.get(match.team_id) ?? [];
    const losers = match.losing_profile_ids?.length ? match.losing_profile_ids : profileIdsByTeam.get(match.loser_team_id) ?? [];
    const score = match.match_id ? scoreByMatchId.get(match.match_id) : undefined;
    const cappedMargin = score ? Math.min(MARGIN_CAP, score.margin) : null;
    for (const profileId of winners) {
      const record = recordFor(records, match.event_id, profileId);
      record.wins += 1;
      if (score && cappedMargin !== null) {
        record.marginSum += cappedMargin;
        record.marginGames += 1;
        record.pointsFor += score.winnerPoints;
        record.pointsAgainst += score.loserPoints;
      }
    }
    for (const profileId of losers) {
      const record = recordFor(records, match.event_id, profileId);
      record.losses += 1;
      if (score && cappedMargin !== null) {
        record.marginSum -= cappedMargin;
        record.marginGames += 1;
        record.pointsFor += score.loserPoints;
        record.pointsAgainst += score.winnerPoints;
      }
    }
  }

  // Ajustes manuais ligados a um racha da janela (feitos na tela de ajustes de
  // ranking): vitórias e derrotas somam ao racha; presença positiva marca o
  // jogador como presente e negativa tira a presença desse racha.
  if (adjustmentError) throw new Error(adjustmentError.message);
  const presenceDelta = new Map<string, number>();
  for (const adj of adjustmentRows ?? []) {
    if (!adj.event_id) continue;
    if (adj.metric === "attendance") {
      const key = `${adj.event_id}:${adj.profile_id}`;
      presenceDelta.set(key, (presenceDelta.get(key) ?? 0) + adj.delta);
      continue;
    }
    const record = recordFor(records, adj.event_id, adj.profile_id);
    if (adj.metric === "wins") record.wins = Math.max(0, record.wins + adj.delta);
    else record.losses = Math.max(0, record.losses + adj.delta);
  }
  for (const [key, delta] of presenceDelta) {
    const [eventId, profileId] = key.split(":");
    if (delta !== 0) recordFor(records, eventId, profileId).present = delta > 0;
  }

  const currentScores = buildScores(events, records);
  const previousScores = events.length > 1 ? buildScores(events.slice(0, -1), records) : new Map<string, ScoreDraft>();
  const currentPositions = positionsFor(currentScores);
  const previousPositions = positionsFor(previousScores);
  const result = new Map<string, SeasonPlayerScore>();

  for (const [profileId, score] of currentScores) {
    const currentPosition = currentPositions.get(profileId);
    const previousPosition = previousPositions.get(profileId);
    const positionChange = currentPosition && previousPosition ? previousPosition - currentPosition : null;
    result.set(profileId, {
      ...score,
      trend: positionChange === null ? "new" : positionChange > 0 ? "up" : positionChange < 0 ? "down" : "same",
      positionChange,
    });
  }
  return result;
}
