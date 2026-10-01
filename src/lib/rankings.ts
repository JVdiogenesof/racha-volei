import type { SupabaseClient } from "@supabase/supabase-js";
import { getPresentProfileIdsByEvent } from "./presence";
import type { Community } from "./community";

export type RankingMetric = "attendance" | "mvp" | "wins";

export type PerformanceStats = {
  wins: number;
  losses: number;
  matches: number;
  percentage: number;
};

export async function getRankingCounts(supabase: SupabaseClient, community: Community = "court") {
  const { data: communityEvents } = await supabase
    .from("events")
    .select("id, date, status, mvp_profile_id, mvp_profile_id_2")
    .eq("community", community)
    .order("date", { ascending: false });
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
      supabase.from("ranking_adjustments").select("profile_id, metric, delta").eq("community", community),
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
    const current = performance.get(profileId) ?? { wins: 0, losses: 0, matches: 0, percentage: 0 };
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

  return { attendance, mvp, wins, performance, streaks };
}
