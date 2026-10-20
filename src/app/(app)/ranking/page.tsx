import { CalendarRange, Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { getRankingCounts, TOURNAMENT_QUALIFYING_SLOTS, TOURNAMENT_QUALIFYING_LABEL } from "@/lib/rankings";
import { formatPointsDiff, getSeasonRanking, INDEX_MIN_EVENTS, ROLLING_INDEX_EVENT_COUNT, SEASON_START_MONTH } from "@/lib/seasonRanking";
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
  // A visão principal é a janela viva dos últimos rachas. Um mês específico
  // continua disponível como foto histórica daquele período.
  const monthKey = requestedMonth && requestedMonth !== "season" ? normalizeMonthKey(requestedMonth) : undefined;
  const isSeasonView = !monthKey;

  const [{ data: profiles }, { data: monthEvents }, counts, seasonScores, { data: reservedPlayers }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, avatar_url").eq("status", "approved").contains("communities", [community]),
    supabase.from("events").select("date").eq("community", community).order("date", { ascending: false }),
    getRankingCounts(supabase, community, monthKey),
    isSeasonView ? getSeasonRanking(supabase, community) : Promise.resolve(null),
    // Quem já garantiu vaga via pré-torneio (passado ou futuro) aparece
    // "classificado" no Índice VPA mesmo se a nota não alcançar o corte.
    supabase.from("tournament_reserved_players").select("profile_id").eq("community", community),
  ]);
  const guaranteedIds = new Set((reservedPlayers ?? []).map((row) => row.profile_id));

  const availableMonths = [...new Set((monthEvents ?? []).map((event) => event.date.slice(0, 7)))]
    .filter((key) => key >= SEASON_START_MONTH)
    .sort()
    .reverse();
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

  const performanceRanking: RankingEntry[] = seasonScores
    ? [...seasonScores.entries()]
        .flatMap(([profileId, season]) => {
          const profile = profileById.get(profileId);
          if (!profile) return [];
          return [{
            profileId,
            count: season.averageIndex,
            fullName: profile.full_name,
            avatarUrl: profile.avatar_url,
            displayValue: season.eligible ? `${season.averageIndex.toFixed(1)} pts` : "Em classificação",
            detail: season.eligible
              ? `${season.eventsPlayed}/${ROLLING_INDEX_EVENT_COUNT} rachas · ${season.totalWins}V · ${season.totalLosses}D${season.pointsFor + season.pointsAgainst > 0 ? ` · saldo ${formatPointsDiff(season.pointsDiff)}` : ""}${season.progressBonus ? ` · +${season.progressBonus.toFixed(1)} evolução` : ""}`
              : `${season.eventsPlayed}/${INDEX_MIN_EVENTS} rachas para classificação`,
            ranked: season.eligible,
            trend: season.trend,
            positionChange: season.positionChange,
            guaranteed: guaranteedIds.has(profileId),
          }];
        })
        .sort(
          (a, b) =>
            Number(b.ranked !== false) - Number(a.ranked !== false) ||
            b.count - a.count ||
            (seasonScores.get(b.profileId)?.totalWins ?? 0) - (seasonScores.get(a.profileId)?.totalWins ?? 0),
        )
    : [...counts.performance.entries()]
        .flatMap(([profileId, stats]) => {
          const profile = profileById.get(profileId);
          if (!profile || !stats.matches) return [];
          return [{
            profileId,
            count: stats.indexScore,
            fullName: profile.full_name,
            avatarUrl: profile.avatar_url,
            displayValue: stats.eligible ? `${stats.indexScore.toFixed(1)} pts` : "Em classificação",
            detail: `${stats.percentage}% · ${stats.wins}V · ${stats.losses}D · ${stats.attendance} pres. (${formatMonthLabel(monthKey!)})`,
            ranked: stats.eligible,
            guaranteed: guaranteedIds.has(profileId),
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
    <div className="space-y-3">
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-xl font-bold text-white">
            <Trophy className="h-5 w-5 shrink-0 text-purple-300" strokeWidth={2.25} />
            Ranking · {community === "sand" ? "Areia" : "Quadra"}
          </h1>
          <p className="mt-0.5 text-xs leading-snug text-white/55">
            {isSeasonView
              ? `Índice VPA vivo: últimos ${ROLLING_INDEX_EVENT_COUNT} rachas, com peso maior para os ${Math.min(4, ROLLING_INDEX_EVENT_COUNT)} mais recentes.`
              : `Foto isolada de ${formatMonthLabel(monthKey!)}, só pra conferir como estava aquele mês.`}
          </p>
        </div>
        <form className="flex shrink-0 items-center gap-1.5" action="/ranking">
          <FormSelect id="month" aria-label="Período" name="month" defaultValue={monthKey ?? "season"} className="min-w-[11rem] capitalize text-xs font-semibold">
            <option value="season">Índice VPA · últimos {ROLLING_INDEX_EVENT_COUNT} rachas</option>
            {availableMonths.map((key) => <option key={key} value={key}>{formatMonthLabel(key)}</option>)}
          </FormSelect>
          <button type="submit" aria-label="Ver período" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white transition hover:bg-white/15">
            <CalendarRange className="h-4 w-4" strokeWidth={2.25} />
          </button>
        </form>
      </div>
      <RankingTabs
        currentProfileId={currentProfile.id}
        rankings={{ performance: performanceRanking, wins: winsRanking, mvp: mvpRanking, attendance: attendanceRanking }}
        qualifying={isSeasonView ? { slots: TOURNAMENT_QUALIFYING_SLOTS, label: TOURNAMENT_QUALIFYING_LABEL } : undefined}
      />
    </div>
  );
}
