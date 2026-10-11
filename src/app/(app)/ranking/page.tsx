import { CalendarRange } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { getRankingCounts, PERFORMANCE_MIN_MATCHES, TOURNAMENT_QUALIFYING_SLOTS, TOURNAMENT_QUALIFYING_LABEL } from "@/lib/rankings";
import { type RankingEntry } from "@/components/Leaderboard";
import { RankingTabs } from "@/components/RankingTabs";
import { getActiveCommunity } from "@/lib/community";
import { formatMonthLabel, normalizeMonthKey } from "@/lib/monthlyReport";
import { FormSelect } from "@/components/FormSelect";

export default async function RankingPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const currentProfile = await requireProfile();
  const supabase = await createClient();
  const community = await getActiveCommunity(currentProfile);
  const requestedMonth = (await searchParams).month;
  const monthKey = requestedMonth && requestedMonth !== "all" ? normalizeMonthKey(requestedMonth) : undefined;

  const [{ data: profiles }, { data: monthEvents }, counts] = await Promise.all([
    supabase.from("profiles").select("id, full_name, avatar_url").eq("status", "approved").contains("communities", [community]),
    supabase.from("events").select("date").eq("community", community).order("date", { ascending: false }),
    getRankingCounts(supabase, community, monthKey),
  ]);

  const availableMonths = [...new Set((monthEvents ?? []).map((event) => event.date.slice(0, 7)))].sort().reverse();
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  function buildRanking(rawCounts: Map<string, number>): RankingEntry[] {
    return [...rawCounts.entries()]
      .map(([profileId, count]) => {
        const profile = profileById.get(profileId);
        if (!profile) return null;
        return {
          profileId,
          count: Math.max(0, count),
          fullName: profile.full_name,
          avatarUrl: profile.avatar_url,
        };
      })
      .filter((entry): entry is RankingEntry => entry !== null)
      .sort((a, b) => b.count - a.count);
  }

  const attendanceRanking = buildRanking(counts.attendance);
  const mvpRanking = buildRanking(counts.mvp);
  const winsRanking = buildRanking(counts.wins);
  const performanceRanking: RankingEntry[] = [...counts.performance.entries()]
    .flatMap(([profileId, stats]) => {
      const profile = profileById.get(profileId);
      if (!profile || !stats.matches) return [];
      return [{
        profileId,
        count: stats.indexScore,
        fullName: profile.full_name,
        avatarUrl: profile.avatar_url,
        displayValue: stats.eligible ? `${stats.indexScore.toFixed(1)} pts` : "Em classificação",
        detail: stats.eligible
          ? `${stats.percentage}% · ${stats.wins}V · ${stats.losses}D · ${stats.attendance} pres.`
          : `${stats.matches}/${PERFORMANCE_MIN_MATCHES} partidas · ${stats.percentage}% atual`,
        ranked: stats.eligible,
      }];
    })
    .sort(
      (a, b) =>
        Number(b.ranked !== false) - Number(a.ranked !== false) ||
        b.count - a.count ||
        (counts.performance.get(b.profileId)?.percentage ?? 0) - (counts.performance.get(a.profileId)?.percentage ?? 0) ||
        (counts.performance.get(b.profileId)?.wins ?? 0) - (counts.performance.get(a.profileId)?.wins ?? 0),
    );

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Ranking · {community === "sand" ? "Areia" : "Quadra"}</h1>
          <p className="mt-1 text-sm text-white/60">
            {monthKey
              ? `Classificação de ${formatMonthLabel(monthKey)}.`
              : "Compare resultados e acompanhe sua posição em cada categoria desde o início."}
          </p>
        </div>
        <form className="flex items-end gap-2" action="/ranking">
          <FormSelect id="month" label="Período" icon={CalendarRange} name="month" defaultValue={monthKey ?? "all"} className="capitalize font-semibold">
            <option value="all">Geral (desde o início)</option>
            {availableMonths.map((key) => <option key={key} value={key}>{formatMonthLabel(key)}</option>)}
          </FormSelect>
          <button type="submit" className="min-h-10 rounded-xl bg-white/10 px-3 text-sm font-bold text-white transition hover:bg-white/15">Ver</button>
        </form>
      </div>
      <RankingTabs
        currentProfileId={currentProfile.id}
        rankings={{ performance: performanceRanking, wins: winsRanking, mvp: mvpRanking, attendance: attendanceRanking }}
        qualifying={monthKey ? undefined : { slots: TOURNAMENT_QUALIFYING_SLOTS, label: TOURNAMENT_QUALIFYING_LABEL }}
      />
    </div>
  );
}
