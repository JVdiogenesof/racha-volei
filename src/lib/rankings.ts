import type { SupabaseClient } from "@supabase/supabase-js";

export type RankingMetric = "attendance" | "mvp" | "wins";

export async function getRankingCounts(supabase: SupabaseClient) {
  const [{ data: attendanceRows }, { data: voteRows }, { data: winRows }, { data: memberRows }, { data: adjustmentRows }] =
    await Promise.all([
      supabase.from("attendance").select("profile_id").eq("status", "confirmed"),
      supabase.from("mvp_votes").select("event_id, voted_for_profile_id"),
      supabase.from("match_wins").select("team_id"),
      supabase.from("team_members").select("team_id, profile_id"),
      supabase.from("ranking_adjustments").select("profile_id, metric, delta"),
    ]);

  const attendance = new Map<string, number>();
  for (const row of attendanceRows ?? []) {
    attendance.set(row.profile_id, (attendance.get(row.profile_id) ?? 0) + 1);
  }

  const perEventTally = new Map<string, Map<string, number>>();
  for (const vote of voteRows ?? []) {
    if (!perEventTally.has(vote.event_id)) perEventTally.set(vote.event_id, new Map());
    const tally = perEventTally.get(vote.event_id)!;
    tally.set(vote.voted_for_profile_id, (tally.get(vote.voted_for_profile_id) ?? 0) + 1);
  }
  const mvp = new Map<string, number>();
  for (const tally of perEventTally.values()) {
    const max = Math.max(...tally.values());
    for (const [profileId, count] of tally) {
      if (count === max) mvp.set(profileId, (mvp.get(profileId) ?? 0) + 1);
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
