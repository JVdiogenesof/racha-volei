import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Community } from "@/lib/community";
import { getSeasonRanking } from "@/lib/seasonRanking";
import { sendPushToProfiles } from "@/lib/push";

export const COPA_PATH = "/torneios-vpa/copa";

export type Cup = {
  id: string;
  community: Community;
  name: string;
  final_date: string;
  qualifier_dates: string[];
  num_teams: number;
  team_size: number;
  final_event_id: string | null;
};

export type CupQualifiedSource = "champion" | "ranking" | "manual";

export type RankingCandidate = {
  profileId: string;
  fullName: string;
  avatarUrl: string | null;
  isSetter: boolean;
  /** Posição no Índice VPA (só para quem já está classificado no índice). */
  position: number | null;
  averageIndex: number;
  eligible: boolean;
};

const CUP_COLUMNS = "id, community, name, final_date, qualifier_dates, num_teams, team_size, final_event_id";

export function cupCapacity(cup: Pick<Cup, "num_teams" | "team_size">) {
  return cup.num_teams * cup.team_size;
}

/** A copa em destaque: a próxima final, ou a mais recente se todas já passaram. */
export async function getFeaturedCup(supabase: SupabaseClient, community: Community): Promise<Cup | null> {
  const today = new Date().toISOString().slice(0, 10);
  const { data: upcoming } = await supabase
    .from("cups")
    .select(CUP_COLUMNS)
    .eq("community", community)
    .gte("final_date", today)
    .order("final_date", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (upcoming) return upcoming as Cup;
  const { data: latest } = await supabase
    .from("cups")
    .select(CUP_COLUMNS)
    .eq("community", community)
    .order("final_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (latest as Cup | null) ?? null;
}

/**
 * Fila de quem herda vagas pelo ranking: Índice VPA vivo, levantadores
 * primeiro (regra da copa), depois os demais. Quem ainda não tem rachas
 * suficientes para entrar no índice só aparece depois de todos os ranqueados.
 */
export async function getCupRankingQueue(
  supabase: SupabaseClient,
  community: Community,
  excludeIds: Set<string>,
): Promise<RankingCandidate[]> {
  const [season, { data: profiles }] = await Promise.all([
    getSeasonRanking(supabase, community),
    supabase
      .from("profiles")
      .select("id, full_name, avatar_url, is_setter")
      .eq("status", "approved")
      .contains("communities", [community]),
  ]);
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  const ordered = [...season.values()]
    .filter((score) => profileById.has(score.profileId))
    .sort(
      (a, b) =>
        Number(b.eligible) - Number(a.eligible) ||
        b.averageIndex - a.averageIndex ||
        b.totalWins - a.totalWins ||
        a.profileId.localeCompare(b.profileId),
    );

  let position = 0;
  const candidates = ordered.map((score) => {
    const profile = profileById.get(score.profileId)!;
    if (score.eligible) position += 1;
    return {
      profileId: score.profileId,
      fullName: profile.full_name,
      avatarUrl: profile.avatar_url,
      isSetter: Boolean(profile.is_setter),
      position: score.eligible ? position : null,
      averageIndex: score.averageIndex,
      eligible: score.eligible,
    } satisfies RankingCandidate;
  });

  const available = candidates.filter((candidate) => !excludeIds.has(candidate.profileId));
  const tier = (candidate: RankingCandidate) => (candidate.eligible ? 0 : 2) + (candidate.isSetter ? 0 : 1);
  // sort é estável: dentro de cada faixa, mantém a ordem do índice.
  return available.sort((a, b) => tier(a) - tier(b));
}

async function lockIntoFinal(supabase: SupabaseClient, cup: Cup, profileIds: string[]) {
  const failed: string[] = [];
  if (!cup.final_event_id || !profileIds.length) return failed;
  const { data: locked } = await supabase
    .from("event_locked_players")
    .select("profile_id")
    .eq("event_id", cup.final_event_id)
    .in("profile_id", profileIds);
  const alreadyLocked = new Set((locked ?? []).map((row) => row.profile_id));
  for (const profileId of profileIds) {
    if (alreadyLocked.has(profileId)) continue;
    const { error } = await supabase.rpc("lock_event_participant", {
      p_event_id: cup.final_event_id,
      p_profile_id: profileId,
      p_note: `Classificado(a) para a ${cup.name}`,
    });
    if (error) {
      console.error("[copa] Não foi possível garantir a vaga na final", { profileId, message: error.message });
      failed.push(profileId);
    }
  }
  return failed;
}

async function releaseFromFinal(supabase: SupabaseClient, cup: Cup, profileIds: string[]) {
  if (!cup.final_event_id || !profileIds.length) return;
  const { data: locked } = await supabase
    .from("event_locked_players")
    .select("profile_id")
    .eq("event_id", cup.final_event_id)
    .in("profile_id", profileIds);
  for (const row of locked ?? []) {
    const { error } = await supabase.rpc("release_locked_event_participant", {
      p_event_id: cup.final_event_id,
      p_profile_id: row.profile_id,
    });
    // Vaga já paga não é liberada sozinha: fica para o organizador resolver
    // pelo controle de desistência/transferência.
    if (error) console.error("[copa] Vaga na final mantida", { profileId: row.profile_id, message: error.message });
  }
}

async function getCup(supabase: SupabaseClient, cupId: string): Promise<Cup> {
  const { data, error } = await supabase.from("cups").select(CUP_COLUMNS).eq("id", cupId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Copa não encontrada.");
  return data as Cup;
}

async function getQualifiedIds(supabase: SupabaseClient, cupId: string) {
  const { data, error } = await supabase.from("cup_qualified_players").select("profile_id").eq("cup_id", cupId);
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((row) => row.profile_id));
}

async function findCupForQualifier(supabase: SupabaseClient, eventId: string): Promise<Cup | null> {
  const { data, error } = await supabase.from("cup_qualifiers").select("cup_id").eq("event_id", eventId).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? getCup(supabase, data.cup_id) : null;
}

async function deleteEventQualifications(supabase: SupabaseClient, cupId: string, eventId: string) {
  const { data: removed, error } = await supabase
    .from("cup_qualified_players")
    .delete()
    .eq("cup_id", cupId)
    .eq("source_event_id", eventId)
    .select("profile_id");
  if (error) throw new Error(error.message);
  return (removed ?? []).map((row) => row.profile_id);
}

/** Desfaz as vagas que vieram de uma classificatória (final desfeita). */
export async function clearCupQualificationsFromEvent(supabase: SupabaseClient, eventId: string) {
  const cup = await findCupForQualifier(supabase, eventId);
  if (!cup) return;
  const removed = await deleteEventQualifications(supabase, cup.id, eventId);
  await releaseFromFinal(supabase, cup, removed);
}

/**
 * Final de uma classificatória lançada: cada campeão ainda não classificado
 * ganha a vaga; quem já estava classificado repassa a vaga ao próximo da fila
 * do ranking (levantadores primeiro). Relançar o placar refaz tudo desse racha.
 */
export async function qualifyCupChampions(
  supabase: SupabaseClient,
  eventId: string,
  championIds: string[],
  organizerId: string,
) {
  const cup = await findCupForQualifier(supabase, eventId);
  if (!cup) return;

  // Placar corrigido: refaz as vagas deste racha do zero, mas só tira da
  // lista da final quem realmente perdeu a vaga (sem liberar e reofertar à
  // toa a vaga de quem continua classificado).
  const previousIds = await deleteEventQualifications(supabase, cup.id, eventId);
  const qualified = await getQualifiedIds(supabase, cup.id);

  const champions = [...new Set(championIds)];
  const newChampions = champions.filter((id) => !qualified.has(id));
  const repeatWinners = champions.filter((id) => qualified.has(id));

  const rows: {
    cup_id: string;
    profile_id: string;
    source: CupQualifiedSource;
    source_event_id: string;
    replaces_profile_id: string | null;
    ranking_position: number | null;
    added_by: string;
  }[] = newChampions.map((profileId) => ({
    cup_id: cup.id,
    profile_id: profileId,
    source: "champion",
    source_event_id: eventId,
    replaces_profile_id: null,
    ranking_position: null,
    added_by: organizerId,
  }));

  if (repeatWinners.length) {
    const taken = new Set([...qualified, ...champions]);
    const queue = await getCupRankingQueue(supabase, cup.community, taken);
    repeatWinners.forEach((repeatId, index) => {
      const next = queue[index];
      if (!next) return;
      rows.push({
        cup_id: cup.id,
        profile_id: next.profileId,
        source: "ranking",
        source_event_id: eventId,
        replaces_profile_id: repeatId,
        ranking_position: next.position,
        added_by: organizerId,
      });
    });
  }

  if (rows.length) {
    const { error } = await supabase.from("cup_qualified_players").insert(rows);
    if (error) throw new Error(error.message);
  }

  const currentIds = rows.map((row) => row.profile_id);
  const previous = new Set(previousIds);
  await releaseFromFinal(supabase, cup, previousIds.filter((id) => !currentIds.includes(id)));
  await lockIntoFinal(supabase, cup, currentIds);

  const newChampionsToNotify = newChampions.filter((id) => !previous.has(id));
  const rankingIds = rows.filter((row) => row.source === "ranking" && !previous.has(row.profile_id)).map((row) => row.profile_id);
  if (!newChampionsToNotify.length && !rankingIds.length) return;

  const finalLabel = new Date(`${cup.final_date}T00:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  await sendPushToProfiles(supabase, newChampionsToNotify, {
    title: `Classificado(a) para a ${cup.name}! 🏆`,
    body: `Seu time venceu a classificatória. Você está na final de ${finalLabel}.`,
    url: COPA_PATH,
  });
  await sendPushToProfiles(supabase, rankingIds, {
    title: `Vaga na ${cup.name} pelo ranking! 🏆`,
    body: `Um campeão repetiu a vitória e a vaga veio pra você pelo Índice VPA. Final em ${finalLabel}.`,
    url: COPA_PATH,
  });
}

/** Membros do time que venceu a final do racha, ou null se a final não tem placar. */
export async function getEventChampionIds(supabase: SupabaseClient, eventId: string): Promise<string[] | null> {
  const { data: final, error } = await supabase
    .from("tournament_matches")
    .select("team_a_id, team_b_id, score_a, score_b")
    .eq("event_id", eventId)
    .eq("stage", "final")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!final || final.score_a == null || final.score_b == null) return null;
  const championTeamId = final.score_a > final.score_b ? final.team_a_id : final.team_b_id;
  const { data: members, error: membersError } = await supabase
    .from("team_members")
    .select("profile_id")
    .eq("team_id", championTeamId);
  if (membersError) throw new Error(membersError.message);
  return [...new Set((members ?? []).map((member) => member.profile_id))];
}

/** Recalcula as vagas de uma classificatória a partir da final já lançada. */
export async function reprocessCupQualifier(supabase: SupabaseClient, eventId: string, organizerId: string) {
  const championIds = await getEventChampionIds(supabase, eventId);
  if (!championIds) return false;
  await qualifyCupChampions(supabase, eventId, championIds, organizerId);
  return true;
}

/** Racha recém-criado numa data da copa vira classificatória ou final sozinho. */
export async function linkEventToCup(
  supabase: SupabaseClient,
  event: { id: string; date: string; community: Community },
) {
  const { data: cups, error } = await supabase
    .from("cups")
    .select(CUP_COLUMNS)
    .eq("community", event.community)
    .or(`final_date.eq.${event.date},qualifier_dates.cs.{${event.date}}`);
  if (error) throw new Error(error.message);

  for (const cup of (cups ?? []) as Cup[]) {
    if (cup.final_date === event.date) {
      if (cup.final_event_id) continue;
      const { error: updateError } = await supabase.from("cups").update({ final_event_id: event.id }).eq("id", cup.id);
      if (updateError) throw new Error(updateError.message);
      await syncCupFinalList(supabase, { ...cup, final_event_id: event.id });
    } else {
      const { error: insertError } = await supabase
        .from("cup_qualifiers")
        .upsert({ cup_id: cup.id, event_id: event.id }, { onConflict: "event_id", ignoreDuplicates: true });
      if (insertError) throw new Error(insertError.message);
    }
  }
}

/** Garante na lista da final todos os classificados que ainda não estão lá. */
export async function syncCupFinalList(supabase: SupabaseClient, cup: Cup) {
  if (!cup.final_event_id) return { added: 0, failed: 0 };
  const qualified = [...(await getQualifiedIds(supabase, cup.id))];
  const { data: lockedBefore } = await supabase
    .from("event_locked_players")
    .select("profile_id")
    .eq("event_id", cup.final_event_id);
  const before = new Set((lockedBefore ?? []).map((row) => row.profile_id));
  const pending = qualified.filter((id) => !before.has(id));
  const failed = await lockIntoFinal(supabase, cup, pending);
  return { added: pending.length - failed.length, failed: failed.length };
}

export async function releaseCupPlayerFromFinal(supabase: SupabaseClient, cupId: string, profileId: string) {
  await releaseFromFinal(supabase, await getCup(supabase, cupId), [profileId]);
}

export async function lockCupPlayersIntoFinal(supabase: SupabaseClient, cupId: string, profileIds: string[]) {
  return lockIntoFinal(supabase, await getCup(supabase, cupId), profileIds);
}
