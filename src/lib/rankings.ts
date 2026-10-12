import type { SupabaseClient } from "@supabase/supabase-js";
import { getPresentProfileIdsByEvent } from "./presence";
import type { Community } from "./community";
import { monthRange } from "./monthlyReport";

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
export const TOURNAMENT_QUALIFYING_SLOTS = 12;
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
    .select("id, date, status, mvp_profile_id, mvp_profile_id_2")
    .eq("community", community)
    .order("date", { ascending: false });
  if (range) {
    eventsQuery = eventsQuery.gte("date", range.start).lt("date", range.nextStart);
  }
  const { data: communityEvents } = await eventsQuery;
  const finishedEvents = (communityEvents ?? []).filter((event) => event.status === "finished");
  const finishedEventIds = (finishedEvents ?? []).map((e) => e.id);
  const communityEventIds = (communityEvents ?? []).map((event) => event.id);
  const impossibleEventId = "00000000-0000-0000-0000-000000000000";

  const [presentByEvent, { data: mvpEvents }, { data: winRows }, { data: memberRows }, { data: adjustmentRows }] =
    await Promise.all([
      getPresentProfileIdsByEvent(supabase, finishedEventIds),
      Promise.resolve({ data: communityEvents ?? [] }),
      supabase
        .from("match_wins")
        .select("team_id, loser_team_id, winning_profile_ids, losing_profile_ids, events(is_pre_torneio)")
        .in("event_id", communityEventIds.length ? communityEventIds : [impossibleEventId]),
      supabase.from("team_members").select("team_id, profile_id"),
      (() => {
        let adjustmentsQuery = supabase
          .from("ranking_adjustments")
          .select("profile_id, metric, delta")
          .eq("community", community);
        // Ajustes manuais não têm racha associado, então quando a visão é de
        // um período específico só aplicamos os lançados dentro dele --
        // senão uma correção lifetime distorceria a liderança histórica.
        if (range) {
          adjustmentsQuery = adjustmentsQuery.gte("created_at", range.start).lt("created_at", range.nextStart);
        }
        return adjustmentsQuery;
      })(),
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

  const profileIdsByTeam = new Map<string, string[]>();
  for (const m of memberRows ?? []) {
    if (!profileIdsByTeam.has(m.team_id)) profileIdsByTeam.set(m.team_id, []);
    profileIdsByTeam.get(m.team_id)!.push(m.profile_id);
  }
  const wins = new Map<string, number>();
  for (const w of winRows ?? []) {
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
    const event = match.events as unknown as { is_pre_torneio: boolean } | null;
    if (event?.is_pre_torneio || !match.loser_team_id) continue;

    const winnerIds = match.winning_profile_ids?.length
      ? match.winning_profile_ids
      : profileIdsByTeam.get(match.team_id) ?? [];
    const loserIds = match.losing_profile_ids?.length
      ? match.losing_profile_ids
      : profileIdsByTeam.get(match.loser_team_id) ?? [];
    for (const profileId of winnerIds) addResult(profileId, true);
    for (const profileId of loserIds) addResult(profileId, false);
  }

  const byMetric: Record<RankingMetric, Map<string, number>> = { attendance, mvp, wins };
  for (const adj of adjustmentRows ?? []) {
    const target = byMetric[adj.metric as RankingMetric];
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

  return { attendance, mvp, wins, performance, streaks };
}
