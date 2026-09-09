import { CalendarCheck, Trophy, Crown } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { Leaderboard, type RankingEntry } from "@/components/Leaderboard";

export default async function RankingPage() {
  await requireProfile();
  const supabase = await createClient();

  const [{ data: attendanceRows }, { data: voteRows }, { data: profiles }, { data: winRows }, { data: memberRows }] =
    await Promise.all([
      supabase.from("attendance").select("profile_id").eq("status", "confirmed"),
      supabase.from("mvp_votes").select("event_id, voted_for_profile_id"),
      supabase.from("profiles").select("id, full_name, avatar_url").eq("status", "approved"),
      supabase.from("match_wins").select("team_id"),
      supabase.from("team_members").select("team_id, profile_id"),
    ]);

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  function buildRanking(counts: Map<string, number>): RankingEntry[] {
    return [...counts.entries()]
      .map(([profileId, count]) => {
        const profile = profileById.get(profileId);
        if (!profile) return null;
        return {
          profileId,
          count,
          fullName: profile.full_name,
          avatarUrl: profile.avatar_url,
        };
      })
      .filter((entry): entry is RankingEntry => entry !== null)
      .sort((a, b) => b.count - a.count);
  }

  const attendanceCount = new Map<string, number>();
  for (const row of attendanceRows ?? []) {
    attendanceCount.set(row.profile_id, (attendanceCount.get(row.profile_id) ?? 0) + 1);
  }

  const perEventTally = new Map<string, Map<string, number>>();
  for (const vote of voteRows ?? []) {
    if (!perEventTally.has(vote.event_id)) perEventTally.set(vote.event_id, new Map());
    const tally = perEventTally.get(vote.event_id)!;
    tally.set(vote.voted_for_profile_id, (tally.get(vote.voted_for_profile_id) ?? 0) + 1);
  }
  const mvpCount = new Map<string, number>();
  for (const tally of perEventTally.values()) {
    const max = Math.max(...tally.values());
    for (const [profileId, count] of tally) {
      if (count === max) {
        mvpCount.set(profileId, (mvpCount.get(profileId) ?? 0) + 1);
      }
    }
  }

  const profileIdsByTeam = new Map<string, string[]>();
  for (const m of memberRows ?? []) {
    if (!profileIdsByTeam.has(m.team_id)) profileIdsByTeam.set(m.team_id, []);
    profileIdsByTeam.get(m.team_id)!.push(m.profile_id);
  }
  const matchWinCount = new Map<string, number>();
  for (const w of winRows ?? []) {
    for (const profileId of profileIdsByTeam.get(w.team_id) ?? []) {
      matchWinCount.set(profileId, (matchWinCount.get(profileId) ?? 0) + 1);
    }
  }

  const attendanceRanking = buildRanking(attendanceCount);
  const mvpRanking = buildRanking(mvpCount);
  const winsRanking = buildRanking(matchWinCount);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-brand-navy">Ranking</h1>
        <p className="mt-1 text-sm text-gray-500">Quem mais aparece e quem mais brilha nos rachas.</p>
      </div>

      <Leaderboard
        title="Mais presença"
        icon={CalendarCheck}
        unit="presenças"
        ranking={attendanceRanking}
      />

      <Leaderboard title="Mais vezes MVP" icon={Trophy} unit="MVPs" ranking={mvpRanking} />

      <Leaderboard title="Mais vitórias" icon={Crown} unit="vitórias" ranking={winsRanking} />
    </div>
  );
}
