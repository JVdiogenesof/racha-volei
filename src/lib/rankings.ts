import type { SupabaseClient } from "@supabase/supabase-js";
import { getPresentProfileIdsByEvent } from "./presence";

export type RankingMetric = "attendance" | "mvp" | "wins";

export async function getRankingCounts(supabase: SupabaseClient) {
  const { data: finishedEvents } = await supabase.from("events").select("id").eq("status", "finished");
  const finishedEventIds = (finishedEvents ?? []).map((e) => e.id);

  const [presentByEvent, { data: mvpEvents }, { data: winRows }, { data: memberRows }, { data: adjustmentRows }] =
    await Promise.all([
      getPresentProfileIdsByEvent(supabase, finishedEventIds),
      supabase.from("events").select("mvp_profile_id, mvp_profile_id_2"),
      supabase.from("match_wins").select("team_id"),
      supabase.from("team_members").select("team_id, profile_id"),
      supabase.from("ranking_adjustments").select("profile_id, metric, delta"),
    ]);

  // Só conta presença de racha já encerrado, e só quem de fato ficou
  // confirmado (ou no time) até lá -- não quem só marcou "vou" e depois saiu.
  const attendance = new Map<string, number>();
  for (const profileIds of presentByEvent.values()) {
    for (const profileId of profileIds) {
      attendance.set(profileId, (attendance.get(profileId) ?? 0) + 1);
    }
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
    for (const profileId of profileIdsByTeam.get(w.team_id) ?? []) {
      wins.set(profileId, (wins.get(profileId) ?? 0) + 1);
    }
  }

  const byMetric: Record<RankingMetric, Map<string, number>> = { attendance, mvp, wins };
  for (const adj of adjustmentRows ?? []) {
    const target = byMetric[adj.metric as RankingMetric];
    target.set(adj.profile_id, (target.get(adj.profile_id) ?? 0) + adj.delta);
  }

  return { attendance, mvp, wins };
}
