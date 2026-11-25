import type { SupabaseClient } from "@supabase/supabase-js";
import { getPresentProfileIdsByEvent } from "./presence";
import type { Community } from "./community";
import { monthRange } from "./monthlyReport";
import { countsTowardIndexResults, countsTowardMatchRanking } from "./matchRankingEligibility";

export type RankingMetric = "attendance" | "mvp" | "wins";

export type PerformanceStats = {
  wins: number;
  losses: number;
  matches: number;
  percentage: number;
  attendance: number;
  attendancePercentage: number;
  indexScore: number;
  eligible: boolean;
};

// Mínimo de presenças confirmadas em rachas encerrados (por período) pra o
// período contar no Índice VPA -- 1 racha já basta.
export const PERFORMANCE_MIN_ATTENDANCE = 1;

// Vagas provisórias do torneio oficial de abril/2027 que vêm do Índice VPA
// geral (o resto das vagas é via pré-torneio). Número ainda não fechado com
// o organizador -- é só mudar aqui quando decidirem o valor final.
export const TOURNAMENT_QUALIFYING_SLOTS = 24;

// Dentro das vagas do Índice, as 10 primeiras ganham destaque extra (verde)
// na tabela -- o resto até o corte aparece em azul.
export const TOURNAMENT_TOP_TIER_SLOTS = 10;
export const TOURNAMENT_QUALIFYING_LABEL = "Vagas · Torneio oficial de abril/2027";

// O Índice VPA usa duas ideias pra ficar mais justo com amostra pequena:
// 1) o aproveitamento "encolhe" em direção a 50% (resultado neutro de um jogo
//    de 2 times) enquanto o jogador tem poucas partidas -- uma sequência boa
//    em poucos jogos não pesa como se fosse sustentada por muitos jogos;
// 2) o peso da presença no índice não é fixo: ele cresce conforme o jogador
//    se aproxima da assiduidade do jogador mais presente, então quem vai a
//    mais rachas tem a presença valorizada de forma ainda maior.
export const INDEX_BASE_PERCENTAGE = 50;
export const INDEX_CONFIDENCE_MATCHES = 8;
export const INDEX_ATTENDANCE_WEIGHT_MIN = 0.3;
export const INDEX_ATTENDANCE_WEIGHT_MAX = 0.5;

export function computeIndexScore(
  stats: { matches: number; percentage: number; attendance: number },
  attendanceLeader: number,
) {
  const attendanceRatio = attendanceLeader > 0 ? Math.min(1, Math.max(0, stats.attendance) / attendanceLeader) : 0;
  const attendancePercentage = Math.round(attendanceRatio * 100);

  const confidence = stats.matches / (stats.matches + INDEX_CONFIDENCE_MATCHES);
  const adjustedPercentage = confidence * stats.percentage + (1 - confidence) * INDEX_BASE_PERCENTAGE;

  const attendanceWeight =
    INDEX_ATTENDANCE_WEIGHT_MIN + (INDEX_ATTENDANCE_WEIGHT_MAX - INDEX_ATTENDANCE_WEIGHT_MIN) * attendanceRatio;
  const resultWeight = 1 - attendanceWeight;

  const indexScore = Math.round((adjustedPercentage * resultWeight + attendancePercentage * attendanceWeight) * 10) / 10;
  return { attendancePercentage, indexScore };
}

export type RankingDateRange = { start: string; nextStart: string };

export async function getRankingCounts(
  supabase: SupabaseClient,
  community: Community = "court",
  // Aceita uma chave de mês ("2026-11") pra filtrar um mês só, ou um range
  // explícito de datas -- usado pela temporada pra tratar um período que
  // cobre mais de um mês de calendário (ex.: o período de lançamento, que
  // junta set+out) como uma única amostra.
  monthKeyOrRange?: string | RankingDateRange,
) {
  const range: RankingDateRange | undefined =
    typeof monthKeyOrRange === "string" ? monthRange(monthKeyOrRange) : monthKeyOrRange;

  let eventsQuery = supabase
    .from("events")
    .select("id, date, status, is_pre_torneio, is_mini_torneio, num_teams, counts_for_ranking, mvp_profile_id, mvp_profile_id_2")
    .eq("community", community)
    .eq("counts_for_ranking", true)
    .order("date", { ascending: false });
  if (range) {
    eventsQuery = eventsQuery.gte("date", range.start).lt("date", range.nextStart);
  }
  const { data: communityEvents } = await eventsQuery;
  const finishedEvents = (communityEvents ?? []).filter((event) => event.status === "finished");
  const finishedEventIds = (finishedEvents ?? []).map((e) => e.id);
  const communityEventIds = (communityEvents ?? []).map((event) => event.id);
  const impossibleEventId = "00000000-0000-0000-0000-000000000000";

  const [presentByEvent, { data: mvpEvents }, { data: winRows }, { data: memberRows }, { data: adjustmentRows }, { data: tournamentRows }] =
    await Promise.all([
      getPresentProfileIdsByEvent(supabase, finishedEventIds),
      Promise.resolve({ data: communityEvents ?? [] }),
      supabase
        .from("match_wins")
        .select("event_id, team_id, loser_team_id, winning_profile_ids, losing_profile_ids, winner_score, loser_score")
        .in("event_id", communityEventIds.length ? communityEventIds : [impossibleEventId]),
      supabase.from("team_members").select("team_id, profile_id"),
      // Os ajustes ligados a um racha entram pelo próprio racha (já filtrado pelo
      // período); os sem racha só entram quando lançados dentro do período,
      // senão uma correção lifetime distorceria a liderança histórica.
      supabase
        .from("ranking_adjustments")
        .select("profile_id, metric, delta, event_id, created_at")
        .eq("community", community),
      // Placar dos jogos de mini torneio (só entra nos pontos das conquistas).
      supabase
        .from("tournament_matches")
        .select("event_id, team_a_id, team_b_id, score_a, score_b")
        .in("event_id", finishedEventIds.length ? finishedEventIds : [impossibleEventId]),
    ]);

  // Só conta presença de racha já encerrado, e só quem de fato ficou
  // confirmado (ou no time) até lá -- não quem só marcou "vou" e depois saiu.
  const attendance = new Map<string, number>();
  for (const profileIds of presentByEvent.values()) {
    for (const profileId of profileIds) {
      attendance.set(profileId, (attendance.get(profileId) ?? 0) + 1);
    }
  }

  // A sequência usa o mesmo mapa de presença já carregado para o ranking.
  // Antes as telas de jogadores e perfil repetiam todas essas consultas.
  const streaks = new Map<string, number>();
  for (const profileId of new Set([...presentByEvent.values()].flatMap((ids) => [...ids]))) {
    let streak = 0;
    for (const event of finishedEvents) {
      if (!presentByEvent.get(event.id)?.has(profileId)) break;
      streak += 1;
    }
    if (streak > 0) streaks.set(profileId, streak);
  }

  const mvp = new Map<string, number>();
  for (const e of mvpEvents ?? []) {
    for (const profileId of [e.mvp_profile_id, e.mvp_profile_id_2]) {
      if (!profileId) continue;
      mvp.set(profileId, (mvp.get(profileId) ?? 0) + 1);
    }
  }

  // Racha normal com 3 times fica fora do ranking de partidas (ver
  // matchRankingEligibility) -- presença acima já não depende disso.
  const matchRankedEventIds = new Set((communityEvents ?? []).filter(countsTowardMatchRanking).map((event) => event.id));
  // O aproveitamento/Índice ignora também os rachas de sábado (só presença);
  // a aba Vitórias (matchRankedEventIds) continua contando os jogos de sábado.
  const indexResultEventIds = new Set((communityEvents ?? []).filter(countsTowardIndexResults).map((event) => event.id));

  const profileIdsByTeam = new Map<string, string[]>();
  for (const m of memberRows ?? []) {
    if (!profileIdsByTeam.has(m.team_id)) profileIdsByTeam.set(m.team_id, []);
    profileIdsByTeam.get(m.team_id)!.push(m.profile_id);
  }
  const wins = new Map<string, number>();
  for (const w of winRows ?? []) {
    if (!matchRankedEventIds.has(w.event_id)) continue;
    const winnerIds = w.winning_profile_ids?.length
      ? w.winning_profile_ids
      : profileIdsByTeam.get(w.team_id) ?? [];
    for (const profileId of winnerIds) {
      wins.set(profileId, (wins.get(profileId) ?? 0) + 1);
    }
  }

  // Aproveitamento começa nos confrontos do novo fluxo de racha normal.
  // Registros antigos e partidas de pré-torneio continuam contando como
  // vitórias, mas não entram aqui porque não possuem uma derrota pareada.
  const performance = new Map<string, PerformanceStats>();
  const addResult = (profileId: string, won: boolean) => {
    const current = performance.get(profileId) ?? {
      wins: 0,
      losses: 0,
      matches: 0,
      percentage: 0,
      attendance: 0,
      attendancePercentage: 0,
      indexScore: 0,
      eligible: false,
    };
    current.matches += 1;
    if (won) current.wins += 1;
    else current.losses += 1;
    current.percentage = Math.round((current.wins / current.matches) * 100);
    performance.set(profileId, current);
  };

  for (const match of winRows ?? []) {
    if (!match.loser_team_id) continue;
    if (!indexResultEventIds.has(match.event_id)) continue;

    const winnerIds = match.winning_profile_ids?.length
      ? match.winning_profile_ids
      : profileIdsByTeam.get(match.team_id) ?? [];
    const loserIds = match.losing_profile_ids?.length
      ? match.losing_profile_ids
      : profileIdsByTeam.get(match.loser_team_id) ?? [];
    for (const profileId of winnerIds) addResult(profileId, true);
    for (const profileId of loserIds) addResult(profileId, false);
  }

  // Ajustes manuais ligados a um racha:
  //  - presença: soma na aba Presença e conta no Índice (ver seasonRanking);
  //  - destaque: soma na aba Destaques;
  //  - vitórias/derrotas: alimentam o Índice VPA (aqui só no aproveitamento do período).
  // Ajustes sem racha só mexem nas abas de contagem.
  const eventIdSet = new Set(communityEventIds);
  const byMetric: Record<RankingMetric, Map<string, number>> = { attendance, mvp, wins };
  const bumpResult = (profileId: string, winsDelta: number, lossesDelta: number) => {
    const current = performance.get(profileId) ?? {
      wins: 0, losses: 0, matches: 0, percentage: 0, attendance: 0, attendancePercentage: 0, indexScore: 0, eligible: false,
    };
    current.wins = Math.max(0, current.wins + winsDelta);
    current.losses = Math.max(0, current.losses + lossesDelta);
    current.matches = current.wins + current.losses;
    current.percentage = current.matches ? Math.round((current.wins / current.matches) * 100) : 0;
    performance.set(profileId, current);
  };
  for (const adj of adjustmentRows ?? []) {
    if (adj.event_id) {
      if (!eventIdSet.has(adj.event_id)) continue;
      if (adj.metric === "wins") {
        if (indexResultEventIds.has(adj.event_id)) bumpResult(adj.profile_id, adj.delta, 0);
      } else if (adj.metric === "losses") {
        if (indexResultEventIds.has(adj.event_id)) bumpResult(adj.profile_id, 0, adj.delta);
      } else if (adj.metric === "attendance" || adj.metric === "mvp") {
        const target = byMetric[adj.metric as RankingMetric];
        target.set(adj.profile_id, (target.get(adj.profile_id) ?? 0) + adj.delta);
      }
      continue;
    }
    if (range && (adj.created_at < range.start || adj.created_at >= range.nextStart)) continue;
    const target = byMetric[adj.metric as RankingMetric];
    if (!target) continue;
    target.set(adj.profile_id, (target.get(adj.profile_id) ?? 0) + adj.delta);
  }

  // Com menos de PERFORMANCE_MIN_ATTENDANCE presenças, o jogador aparece como "em classificação".
  const attendanceLeader = Math.max(1, ...attendance.values());
  for (const [profileId, stats] of performance) {
    stats.attendance = Math.max(0, attendance.get(profileId) ?? 0);
    const { attendancePercentage, indexScore } = computeIndexScore(stats, attendanceLeader);
    stats.attendancePercentage = attendancePercentage;
    stats.indexScore = indexScore;
    stats.eligible = stats.attendance >= PERFORMANCE_MIN_ATTENDANCE;
  }

  return { attendance, mvp, wins, performance, streaks, ...getPlayStats(finishedEvents, presentByEvent, winRows ?? [], tournamentRows ?? [], profileIdsByTeam) };
}

/**
 * Números extras das conquistas, tirados dos mesmos dados do ranking:
 * partidas jogadas, pontos marcados pelo seu time, rachas em que venceu todas,
 * companheiros de time diferentes e fins de semana com sábado e domingo.
 */
function getPlayStats(
  finishedEvents: { id: string; date: string }[],
  presentByEvent: Map<string, Set<string>>,
  winRows: { event_id: string; team_id: string; loser_team_id: string | null; winning_profile_ids: string[] | null; losing_profile_ids: string[] | null; winner_score: number | null; loser_score: number | null }[],
  tournamentRows: { event_id: string; team_a_id: string | null; team_b_id: string | null; score_a: number | null; score_b: number | null }[],
  profileIdsByTeam: Map<string, string[]>,
) {
  // Conta todo racha encerrado (inclusive os de 3 times, que ficam fora do ranking de partidas).
  const finishedIds = new Set(finishedEvents.map((event) => event.id));
  const matches = new Map<string, number>();
  const points = new Map<string, number>();
  const mates = new Map<string, Set<string>>();
  const day = new Map<string, { played: number; lost: number }>();
  const bump = (map: Map<string, number>, id: string, by = 1) => map.set(id, (map.get(id) ?? 0) + by);

  for (const match of winRows) {
    if (!finishedIds.has(match.event_id)) continue;
    const winners = match.winning_profile_ids?.length ? match.winning_profile_ids : profileIdsByTeam.get(match.team_id) ?? [];
    const losers = match.loser_team_id ? (match.losing_profile_ids?.length ? match.losing_profile_ids : profileIdsByTeam.get(match.loser_team_id) ?? []) : [];
    for (const [side, won, score] of [[winners, true, match.winner_score], [losers, false, match.loser_score]] as const) {
      for (const id of side) {
        bump(matches, id);
        if (score) bump(points, id, score);
        if (!mates.has(id)) mates.set(id, new Set());
        for (const other of side) if (other !== id) mates.get(id)!.add(other);
        // Dia invicto só vale onde o racha registra o perdedor (dá pra saber se perdeu).
        if (match.loser_team_id) {
          const key = `${match.event_id}:${id}`;
          const current = day.get(key) ?? { played: 0, lost: 0 };
          current.played += 1;
          if (!won) current.lost += 1;
          day.set(key, current);
        }
      }
    }
  }

  // No mini torneio o placar fica em tournament_matches (o match_wins vem sem placar).
  for (const game of tournamentRows) {
    if (!finishedIds.has(game.event_id)) continue;
    for (const [team, score] of [[game.team_a_id, game.score_a], [game.team_b_id, game.score_b]] as const) {
      if (!team || !score) continue;
      for (const id of profileIdsByTeam.get(team) ?? []) bump(points, id, score);
    }
  }

  const perfectDays = new Map<string, number>();
  for (const [key, { played, lost }] of day) if (played >= 2 && lost === 0) bump(perfectDays, key.split(":")[1]);

  const teammates = new Map<string, number>();
  for (const [id, set] of mates) teammates.set(id, set.size);

  // Sábado + domingo do mesmo fim de semana.
  const fullWeekends = new Map<string, number>();
  const byDate = new Map(finishedEvents.map((event) => [event.date, event.id]));
  for (const event of finishedEvents) {
    const date = new Date(`${event.date}T12:00:00Z`);
    if (date.getUTCDay() !== 6) continue;
    const sunday = new Date(date.getTime() + 86_400_000).toISOString().slice(0, 10);
    const sundayId = byDate.get(sunday);
    if (!sundayId) continue;
    const both = presentByEvent.get(sundayId);
    for (const id of presentByEvent.get(event.id) ?? []) if (both?.has(id)) bump(fullWeekends, id);
  }

  return { matches, points, perfectDays, teammates, fullWeekends };
}
