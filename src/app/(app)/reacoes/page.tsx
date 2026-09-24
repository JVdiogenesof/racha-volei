import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import {
  formatQueridometroWeek,
  getEligibleQueridometroProfiles,
  getQueridometroPeriod,
  normalizeQueridometroResults,
  type QueridometroResultRow,
  type QueridometroType,
} from "@/lib/queridometro";
import { QueridometroExperience } from "@/components/QueridometroExperience";
import { clearWeeklyReaction, setWeeklyReaction } from "./actions";

type Player = { id: string; fullName: string; avatarUrl: string | null };

function playerResult(rows: QueridometroResultRow[], profileId: string, types: Map<string, QueridometroType>) {
  return rows
    .filter((row) => row.to_profile_id === profileId)
    .flatMap((row) => {
      const type = types.get(row.reaction_key);
      return type ? [{ key: type.key, emoji: type.emoji, label: type.label, description: type.description, total: row.total }] : [];
    })
    .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, "pt-BR"));
}

function groupLeaders(rows: QueridometroResultRow[], playerById: Map<string, Player>) {
  const totals = new Map<string, number>();
  for (const row of rows) totals.set(row.to_profile_id, (totals.get(row.to_profile_id) ?? 0) + row.total);
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .flatMap(([profileId]) => {
      const player = playerById.get(profileId);
      return player ? [player.fullName] : [];
    });
}

export default async function ReacoesPage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const period = getQueridometroPeriod();

  const [
    { data: typeRows },
    { data: allProfileRows },
    eligibleRows,
    { data: ownVoteRows },
    { data: currentResultData },
    { data: connectionData },
    { data: weekRows },
  ] = await Promise.all([
    supabase.from("queridometro_reaction_types").select("key, emoji, label, description, connection_label, active, sort_order").order("sort_order"),
    supabase.from("profiles").select("id, full_name, avatar_url"),
    getEligibleQueridometroProfiles(supabase),
    supabase.from("queridometro_votes").select("to_profile_id, reaction_key").eq("week_start", period.weekStart).eq("from_profile_id", profile.id),
    supabase.rpc("get_queridometro_results", { p_week_start: period.weekStart }),
    supabase.rpc("get_my_queridometro_connections", { p_week_start: period.weekStart }),
    supabase.rpc("get_queridometro_weeks"),
  ]);

  const types = (typeRows ?? []) as QueridometroType[];
  const typeByKey = new Map(types.map((type) => [type.key, type]));
  const allPlayers: Player[] = (allProfileRows ?? []).map((item) => ({ id: item.id, fullName: item.full_name, avatarUrl: item.avatar_url }));
  const playerById = new Map(allPlayers.map((player) => [player.id, player]));
  const eligibleIds = new Set(eligibleRows.map((item) => item.id));
  const eligibleToVote = eligibleIds.has(profile.id);
  const targets: Player[] = eligibleRows
    .filter((item) => item.id !== profile.id)
    .map((item) => ({ id: item.id, fullName: item.full_name, avatarUrl: item.avatar_url }));
  const votes = Object.fromEntries((ownVoteRows ?? []).map((vote) => [vote.to_profile_id, vote.reaction_key]));
  const currentResults = normalizeQueridometroResults(currentResultData);
  const myResults = playerResult(currentResults, profile.id, typeByKey);

  const highlights = types.flatMap((type) => {
    const rows = currentResults.filter((row) => row.reaction_key === type.key);
    const highest = Math.max(0, ...rows.map((row) => row.total));
    if (!highest) return [];
    const players = rows
      .filter((row) => row.total === highest)
      .flatMap((row) => {
        const player = playerById.get(row.to_profile_id);
        return player ? [player] : [];
      });
    return [{ key: type.key, emoji: type.emoji, label: type.label, description: type.description, total: highest, players }];
  });

  const connections = ((connectionData ?? []) as { other_profile_id: string; reaction_key: string; connection_label: string }[]).flatMap((row) => {
    const other = playerById.get(row.other_profile_id);
    const type = typeByKey.get(row.reaction_key);
    return other && type ? [{ profile: other, emoji: type.emoji, label: row.connection_label }] : [];
  });

  const revealedWeeks = ((weekRows ?? []) as { week_start: string; total_votes: number | string }[])
    .filter((week) => week.week_start !== period.weekStart)
    .slice(0, 8);
  const historyResults = await Promise.all(
    revealedWeeks.map(async (week) => {
      const { data } = await supabase.rpc("get_queridometro_results", { p_week_start: week.week_start });
      return normalizeQueridometroResults(data);
    }),
  );
  const history = revealedWeeks.map((week, index) => {
    const results = historyResults[index];
    const mine = playerResult(results, profile.id, typeByKey);
    return {
      weekStart: week.week_start,
      label: formatQueridometroWeek(week.week_start),
      totalVotes: Number(week.total_votes),
      myTotal: mine.reduce((sum, item) => sum + item.total, 0),
      myTop: mine[0] ?? null,
      leaders: groupLeaders(results, playerById),
    };
  });

  return (
    <QueridometroExperience
      weekStart={period.weekStart}
      weekLabel={formatQueridometroWeek(period.weekStart)}
      votingOpen={period.votingOpen}
      revealAvailable={period.revealAvailable}
      eligibleToVote={eligibleToVote}
      players={targets}
      reactionTypes={types.filter((type) => type.active).map(({ key, emoji, label, description }) => ({ key, emoji, label, description }))}
      votes={votes}
      myResults={myResults}
      highlights={highlights}
      connections={connections}
      history={history}
      setReactionAction={setWeeklyReaction}
      clearReactionAction={clearWeeklyReaction}
    />
  );
}
