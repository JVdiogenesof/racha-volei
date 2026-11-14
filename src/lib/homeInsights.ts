import type { SupabaseClient } from "@supabase/supabase-js";
import type { Community } from "@/lib/community";
import { getRankingCounts } from "@/lib/rankings";
import type { SeasonPlayerScore } from "@/lib/seasonRanking";

export type InsightPerson = { id: string; name: string; avatarUrl: string | null };

export type Insight =
  | { id: string; kind: "list"; emoji: string; title: string; unit: string; rows: (InsightPerson & { value: number })[] }
  | { id: string; kind: "pairs"; emoji: string; title: string; unit: string; rows: { a: InsightPerson; b: InsightPerson; value: number }[] };

export type HomeStats = {
  finishedRachas: number;
  activePlayers: number;
  totalPresences: number;
  insights: Insight[];
  /** Posição de presença de quem está vendo (1 = quem mais jogou) e quantos rachas faltam pro de cima. */
  myAttendance: { position: number; count: number; toNext: number | null } | null;
};

type PersonRow = { id: string; full_name: string; avatar_url: string | null };

function shortName(fullName: string): string {
  const [first, second] = fullName.trim().split(/\s+/);
  return second && second.length > 2 ? `${first} ${second[0]}.` : first;
}

// Mesmo texto, mesmo dia -> mesma escolha pra todo mundo (sorteio estável por data).
function hashString(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededOrder<T>(items: T[], seed: string): T[] {
  return items
    .map((item, index) => ({ item, key: hashString(`${seed}:${index}`) }))
    .sort((a, b) => a.key - b.key)
    .map((entry) => entry.item);
}

/** Quantos blocos de curiosidade aparecem por dia. */
export const DAILY_INSIGHT_COUNT = 3;

export async function getHomeStats(
  supabase: SupabaseClient,
  community: Community,
  people: PersonRow[],
  seasonScores: Map<string, SeasonPlayerScore> | null,
  viewerId: string,
  todayKey: string,
): Promise<HomeStats> {
  const byId = new Map<string, InsightPerson>(
    people.map((person) => [person.id, { id: person.id, name: shortName(person.full_name), avatarUrl: person.avatar_url }]),
  );

  const [counts, { data: finishedEvents }] = await Promise.all([
    getRankingCounts(supabase, community),
    supabase.from("events").select("id").eq("community", community).eq("status", "finished"),
  ]);
  const eventIds = (finishedEvents ?? []).map((event) => event.id);

  type MatchRow = { winning_profile_ids: string[] | null; losing_profile_ids: string[] | null; loser_team_id: string | null };
  const matchRows: MatchRow[] = eventIds.length
    ? (
        await supabase
          .from("match_wins")
          .select("winning_profile_ids, losing_profile_ids, loser_team_id")
          .in("event_id", eventIds)
      ).data ?? []
    : [];

  // Quem se enfrentou / jogou junto: só partidas com os dois lados registrados.
  const rivals = new Map<string, number>();
  const duos = new Map<string, number>();
  const pairKey = (x: string, y: string) => (x < y ? `${x}|${y}` : `${y}|${x}`);
  for (const match of matchRows) {
    const winners = (match.winning_profile_ids ?? []).filter((id: string) => byId.has(id));
    const losers = (match.losing_profile_ids ?? []).filter((id: string) => byId.has(id));
    if (!match.loser_team_id || !winners.length || !losers.length) continue;
    for (const w of winners) for (const l of losers) rivals.set(pairKey(w, l), (rivals.get(pairKey(w, l)) ?? 0) + 1);
    for (const side of [winners, losers]) {
      for (let i = 0; i < side.length; i += 1) {
        for (let j = i + 1; j < side.length; j += 1) duos.set(pairKey(side[i], side[j]), (duos.get(pairKey(side[i], side[j])) ?? 0) + 1);
      }
    }
  }

  const topList = (map: Map<string, number>, minValue = 1) =>
    [...map.entries()]
      .filter(([id, value]) => byId.has(id) && value >= minValue)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id, value]) => ({ ...byId.get(id)!, value }));

  const topPairs = (map: Map<string, number>) =>
    [...map.entries()]
      .filter(([, value]) => value >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([key, value]) => {
        const [x, y] = key.split("|");
        return { a: byId.get(x)!, b: byId.get(y)!, value };
      });

  const candidates: Insight[] = [];
  const addList = (id: string, emoji: string, title: string, unit: string, rows: (InsightPerson & { value: number })[]) => {
    if (rows.length >= 2) candidates.push({ id, kind: "list", emoji, title, unit, rows });
  };

  addList("presenca", "🏐", "Quem mais joga", "rachas", topList(counts.attendance));
  addList("sequencia", "🔥", "Maiores sequências", "seguidos", topList(counts.streaks, 2));
  addList("destaques", "⭐", "Mais destaques (MVP)", "vezes", topList(counts.mvp));
  addList("vitorias", "🏆", "Mais vitórias", "vitórias", topList(counts.wins));

  const aproveitamento = new Map<string, number>();
  for (const [id, stats] of counts.performance) if (stats.matches >= 6) aproveitamento.set(id, stats.percentage);
  addList("aproveitamento", "🎯", "Melhor aproveitamento", "%", topList(aproveitamento));

  if (seasonScores) {
    const saldo = new Map<string, number>();
    for (const [id, score] of seasonScores) if (score.pointsDiff > 0) saldo.set(id, score.pointsDiff);
    addList("saldo", "📈", "Melhor saldo de pontos", "pontos", topList(saldo));
  }

  const rivalRows = topPairs(rivals);
  if (rivalRows.length) candidates.push({ id: "rivais", kind: "pairs", emoji: "⚔️", title: "Maiores rivais", unit: "confrontos", rows: rivalRows });
  const duoRows = topPairs(duos);
  if (duoRows.length) candidates.push({ id: "duplas", kind: "pairs", emoji: "🤝", title: "Duplas que mais jogam juntas", unit: "partidas", rows: duoRows });

  const insights = seededOrder(candidates, todayKey).slice(0, DAILY_INSIGHT_COUNT);

  const ordered = [...counts.attendance.entries()].filter(([id]) => byId.has(id)).sort((a, b) => b[1] - a[1]);
  const myIndex = ordered.findIndex(([id]) => id === viewerId);
  const myAttendance =
    myIndex >= 0
      ? {
          position: myIndex + 1,
          count: ordered[myIndex][1],
          toNext: myIndex > 0 ? ordered[myIndex - 1][1] - ordered[myIndex][1] + 1 : null,
        }
      : null;

  return {
    finishedRachas: eventIds.length,
    activePlayers: [...counts.attendance.keys()].filter((id) => byId.has(id)).length,
    totalPresences: [...counts.attendance.values()].reduce((sum, value) => sum + value, 0),
    insights,
    myAttendance,
  };
}
