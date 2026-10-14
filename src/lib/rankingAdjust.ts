import type { SupabaseClient } from "@supabase/supabase-js";
import { getPresentProfileIdsByEvent } from "./presence";
import type { Community } from "./community";

export type AdjustMetric = "attendance" | "mvp" | "wins" | "losses";

export type SheetEvent = {
  id: string;
  date: string;
  kind: "racha" | "pre_torneio" | "mini_torneio";
  registered: { present: boolean; wins: number; losses: number; legacyWins: number; mvp: boolean };
  /** Ajustes manuais já lançados neste racha (soma por métrica). */
  adjust: { attendance: number; mvp: number; wins: number; losses: number };
  /** Valor que vale para o Índice depois dos ajustes. */
  effective: { present: boolean; wins: number; losses: number; mvp: boolean };
};

const SHEET_EVENT_LIMIT = 12;

/**
 * Monta, racha a racha, o que está registrado para o jogador e o que já foi
 * ajustado à mão. As regras de contagem espelham as do Índice VPA: só
 * confrontos com vencedor e perdedor entram em vitórias/derrotas.
 */
export async function getProfileRankingSheet(
  supabase: SupabaseClient,
  community: Community,
  profileId: string,
): Promise<SheetEvent[]> {
  const { data: eventRows, error: eventError } = await supabase
    .from("events")
    .select("id, date, is_pre_torneio, is_mini_torneio, mvp_profile_id, mvp_profile_id_2")
    .eq("community", community)
    .eq("status", "finished")
    .order("date", { ascending: false })
    .limit(SHEET_EVENT_LIMIT);
  if (eventError) throw new Error(eventError.message);
  const events = eventRows ?? [];
  if (!events.length) return [];
  const eventIds = events.map((event) => event.id);

  const [presentByEvent, { data: matchRows, error: matchError }, { data: adjustmentRows, error: adjustmentError }] =
    await Promise.all([
      getPresentProfileIdsByEvent(supabase, eventIds),
      supabase
        .from("match_wins")
        .select("event_id, team_id, loser_team_id, winning_profile_ids, losing_profile_ids")
        .in("event_id", eventIds),
      supabase
        .from("ranking_adjustments")
        .select("event_id, metric, delta")
        .eq("community", community)
        .eq("profile_id", profileId)
        .in("event_id", eventIds),
    ]);
  if (matchError) throw new Error(matchError.message);
  if (adjustmentError) throw new Error(adjustmentError.message);

  const teamIds = [...new Set((matchRows ?? []).flatMap((match) => [match.team_id, match.loser_team_id].filter((id): id is string => Boolean(id))))];
  const { data: memberRows, error: memberError } = teamIds.length
    ? await supabase.from("team_members").select("team_id, profile_id").in("team_id", teamIds)
    : { data: [], error: null };
  if (memberError) throw new Error(memberError.message);
  const membersByTeam = new Map<string, string[]>();
  for (const member of memberRows ?? []) {
    const list = membersByTeam.get(member.team_id) ?? [];
    list.push(member.profile_id);
    membersByTeam.set(member.team_id, list);
  }

  return events.map((event) => {
    let wins = 0;
    let losses = 0;
    let legacyWins = 0;
    for (const match of (matchRows ?? []).filter((row) => row.event_id === event.id)) {
      const winners = match.winning_profile_ids?.length ? match.winning_profile_ids : membersByTeam.get(match.team_id) ?? [];
      const losers = match.losing_profile_ids?.length
        ? match.losing_profile_ids
        : match.loser_team_id
          ? membersByTeam.get(match.loser_team_id) ?? []
          : [];
      if (!match.loser_team_id) {
        if (winners.includes(profileId)) legacyWins += 1;
        continue;
      }
      // Pré-torneio entra só pela presença.
      if (event.is_pre_torneio) continue;
      if (winners.includes(profileId)) wins += 1;
      if (losers.includes(profileId)) losses += 1;
    }

    const adjust = { attendance: 0, mvp: 0, wins: 0, losses: 0 };
    for (const row of (adjustmentRows ?? []).filter((item) => item.event_id === event.id)) {
      if (row.metric in adjust) adjust[row.metric as keyof typeof adjust] += row.delta;
    }

    const present = presentByEvent.get(event.id)?.has(profileId) ?? false;
    const mvp = event.mvp_profile_id === profileId || event.mvp_profile_id_2 === profileId;
    const effectivePresent = adjust.attendance > 0 ? true : adjust.attendance < 0 ? false : present;
    const effectiveMvp = adjust.mvp > 0 ? true : adjust.mvp < 0 ? false : mvp;
    return {
      id: event.id,
      date: event.date,
      kind: event.is_pre_torneio ? "pre_torneio" : event.is_mini_torneio ? "mini_torneio" : "racha",
      registered: { present, wins, losses, legacyWins, mvp },
      adjust,
      effective: {
        present: effectivePresent,
        wins: Math.max(0, wins + adjust.wins),
        losses: Math.max(0, losses + adjust.losses),
        mvp: effectiveMvp,
      },
    };
  });
}
