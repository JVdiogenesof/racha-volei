import type { SupabaseClient } from "@supabase/supabase-js";
import type { Community } from "@/lib/community";
import { getRankingCounts } from "@/lib/rankings";
import type { SeasonPlayerScore } from "@/lib/seasonRanking";

export type InsightPerson = { id: string; name: string; avatarUrl: string | null };

export type Insight =
  | { id: string; kind: "list"; title: string; unit: string; rows: (InsightPerson & { value: number })[] }
  | { id: string; kind: "pairs"; title: string; unit: string; sign: string; rows: { a: InsightPerson; b: InsightPerson; value: number }[] };

export type HomeStats = {
  finishedRachas: number;
  activePlayers: number;
  totalPresences: number;
  insights: Insight[];
  /** Posição de presença de quem está vendo (1 = quem mais jogou) e quantos rachas faltam pro de cima. */
  myAttendance: { position: number; count: number; toNext: number | null } | null;
};

type PersonRow = { id: string; full_name: string; avatar_url: string | null; birthdate?: string | null };

function shortName(fullName: string): string {
  const [first, second] = fullName.trim().split(/\s+/);
  return second && second.length > 2 ? `${first} ${second[0]}.` : first;
}

function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function daysUntilBirthday(birthdate: string, todayKey: string): number {
  const [, month, day] = birthdate.split("-").map(Number);
  const [year, todayMonth, todayDay] = todayKey.split("-").map(Number);
  const today = Date.UTC(year, todayMonth - 1, todayDay);
  let next = Date.UTC(year, month - 1, day);
  if (next < today) next = Date.UTC(year + 1, month - 1, day);
  return Math.round((next - today) / 86_400_000);
}

/** Quantas curiosidades entram no carrossel (sorteadas a cada vez que a tela abre). */
export const INSIGHT_COUNT = 7;

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

  const monthKey = todayKey.slice(0, 7);
  const [counts, monthCounts, { data: finishedEvents }, { data: joinedRows }] = await Promise.all([
    getRankingCounts(supabase, community),
    getRankingCounts(supabase, community, monthKey),
    supabase.from("events").select("id").eq("community", community).eq("status", "finished"),
    supabase.from("profiles").select("id, created_at").eq("status", "approved").contains("communities", [community]),
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
  const duoWins = new Map<string, number>();
  const beat = new Map<string, number>(); // "quem ganhou|de quem"
  const pairKey = (x: string, y: string) => (x < y ? `${x}|${y}` : `${y}|${x}`);
  for (const match of matchRows) {
    const winners = (match.winning_profile_ids ?? []).filter((id: string) => byId.has(id));
    const losers = (match.losing_profile_ids ?? []).filter((id: string) => byId.has(id));
    if (!match.loser_team_id || !winners.length || !losers.length) continue;
    for (const w of winners) {
      for (const l of losers) {
        rivals.set(pairKey(w, l), (rivals.get(pairKey(w, l)) ?? 0) + 1);
        beat.set(`${w}|${l}`, (beat.get(`${w}|${l}`) ?? 0) + 1);
      }
    }
    for (let i = 0; i < winners.length; i += 1) {
      for (let j = i + 1; j < winners.length; j += 1) duoWins.set(pairKey(winners[i], winners[j]), (duoWins.get(pairKey(winners[i], winners[j])) ?? 0) + 1);
    }
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

  const topPairs = (map: Map<string, number>, min = 2) =>
    [...map.entries()]
      .filter(([, value]) => value >= min)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([key, value]) => {
        const [x, y] = key.split("|");
        return { a: byId.get(x)!, b: byId.get(y)!, value };
      });

  const candidates: Insight[] = [];
  const addList = (id: string, title: string, unit: string, rows: (InsightPerson & { value: number })[]) => {
    if (rows.length >= 2) candidates.push({ id, kind: "list", title, unit, rows });
  };

  addList("presenca", "Quem mais joga", "rachas", topList(counts.attendance));
  addList("mes", "Mais presentes do mês", "rachas", topList(monthCounts.attendance));
  addList("sequencia", "Maiores sequências", "seguidos", topList(counts.streaks, 2));
  addList("destaques", "Mais destaques (MVP)", "vezes", topList(counts.mvp));
  addList("vitorias", "Mais vitórias", "vitórias", topList(counts.wins));

  const aproveitamento = new Map<string, number>();
  for (const [id, stats] of counts.performance) if (stats.matches >= 6) aproveitamento.set(id, stats.percentage);
  addList("aproveitamento", "Melhor aproveitamento", "%", topList(aproveitamento));

  if (seasonScores) {
    const saldo = new Map<string, number>();
    const marcados = new Map<string, number>();
    const indice = new Map<string, number>();
    const subiu = new Map<string, number>();
    for (const [id, score] of seasonScores) {
      if (score.pointsDiff > 0) saldo.set(id, score.pointsDiff);
      if (score.pointsFor > 0) marcados.set(id, score.pointsFor);
      if (score.eligible) indice.set(id, Math.round(score.averageIndex * 10) / 10);
      if (score.eligible && score.indexChange && score.indexChange > 0) subiu.set(id, Math.round(score.indexChange * 10) / 10);
    }
    addList("saldo", "Melhor saldo de pontos", "pts", topList(saldo));
    addList("marcados", "Mais pontos marcados", "pts", topList(marcados));
    addList("indice", "Líderes do Índice VPA", "pts", topList(indice));
    addList("subiu", "Quem mais subiu no Índice", "pts", topList(subiu));
  }

  // Quem entrou no VPA há mais e há menos tempo (dias desde o cadastro).
  const todayMs = Date.parse(`${todayKey}T12:00:00Z`);
  const tenure = new Map<string, number>();
  for (const row of joinedRows ?? []) tenure.set(row.id, Math.max(0, Math.round((todayMs - Date.parse(row.created_at)) / 86_400_000)));
  addList("veteranos", "Veteranos do VPA", "dias", topList(tenure, 1));
  const newest = [...tenure.entries()]
    .filter(([id]) => byId.has(id))
    .sort((a, b) => a[1] - b[1])
    .slice(0, 3)
    .map(([id, value]) => ({ ...byId.get(id)!, value }));
  addList("novatos", "Recém-chegados", "dias", newest);

  const birthdays = new Map<string, number>();
  for (const person of people) if (person.birthdate) birthdays.set(person.id, daysUntilBirthday(person.birthdate, todayKey));
  const nextBirthdays = [...birthdays.entries()]
    .filter(([id]) => byId.has(id))
    .sort((a, b) => a[1] - b[1])
    .slice(0, 3)
    .map(([id, value]) => ({ ...byId.get(id)!, value }));
  addList("aniversarios", "Próximos aniversários", "dias", nextBirthdays);

  const addPairs = (id: string, title: string, unit: string, sign: string, rows: { a: InsightPerson; b: InsightPerson; value: number }[]) => {
    if (rows.length) candidates.push({ id, kind: "pairs", title, unit, sign, rows });
  };
  addPairs("rivais", "Maiores rivais", "jogos", "×", topPairs(rivals));
  addPairs("duplas", "Mais jogam juntos", "jogos", "&", topPairs(duos));
  addPairs("duplas-vitorias", "Duplas mais vencedoras", "vitórias", "&", topPairs(duoWins));
  addPairs("freguesia", "Quem mais ganhou de quem", "vezes", "›", topPairs(beat, 3));

  const insights = shuffled(candidates).slice(0, INSIGHT_COUNT);

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
