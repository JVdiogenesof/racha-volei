import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { COPA_PATH, type Cup } from "@/lib/copaVpa";
import { getSeasonRanking } from "@/lib/seasonRanking";
import { sendPushToProfiles } from "@/lib/push";
import { COPA_TEAMS, computeStandings, matchWinner, planDraw, roundRobin, scheduleAt, teamIdentity } from "@/lib/copaDraw";

export type CupTeam = { id: string; slug: string; name: string; position: number };
export type CupMember = {
  profile_id: string;
  team_id: string;
  pot: number;
  pick_order: number;
  revealed_at: string | null;
  player: { full_name: string; avatar_url: string | null; avatar_frame: string | null; is_setter: boolean } | null;
};
export type CupMatch = {
  id: string;
  stage: "group" | "bronze" | "final";
  round: number;
  slot: number;
  team_a_id: string;
  team_b_id: string;
  score_a: number | null;
  score_b: number | null;
  scheduled_at: string | null;
};

export const MEMBER_SELECT =
  "profile_id, team_id, pot, pick_order, revealed_at, player:profiles!cup_team_members_profile_id_fkey(full_name, avatar_url, avatar_frame, is_setter)";

export async function loadCupDay(supabase: SupabaseClient, cupId: string) {
  const [{ data: teams }, { data: members }, { data: matches }] = await Promise.all([
    supabase.from("cup_teams").select("id, slug, name, position").eq("cup_id", cupId).order("position"),
    supabase.from("cup_team_members").select(MEMBER_SELECT).eq("cup_id", cupId).order("pick_order"),
    supabase.from("cup_matches").select("id, stage, round, slot, team_a_id, team_b_id, score_a, score_b, scheduled_at").eq("cup_id", cupId).order("slot"),
  ]);
  return {
    teams: (teams ?? []) as CupTeam[],
    members: (members ?? []) as unknown as CupMember[],
    matches: (matches ?? []) as CupMatch[],
  };
}

export type DrawReadiness = {
  /** Jogadores que o sorteio precisa (times × jogadores por time). */
  needed: number;
  /** Quantos já podem entrar no sorteio agora. */
  ready: number;
  qualified: number;
  /** Com prazo de confirmação aberto, só entra quem confirmou (e pagou, se houver valor). */
  usesConfirmation: boolean;
  /** Levantadores entre os que entram. */
  setters: number;
};

/**
 * Quem entra no sorteio: com confirmação configurada, só os classificados que
 * confirmaram presença (quem desistiu ou não pagou fica de fora); sem
 * confirmação, todos os classificados.
 */
export async function getDrawPool(supabase: SupabaseClient, cup: Pick<Cup, "id" | "num_teams" | "team_size" | "confirm_deadline">) {
  const [{ data: qualified, error }, { data: confirmations, error: confirmError }] = await Promise.all([
    supabase.from("cup_qualified_players").select("profile_id, plays_as_setter").eq("cup_id", cup.id),
    supabase.from("cup_confirmations").select("profile_id").eq("cup_id", cup.id).eq("status", "confirmed"),
  ]);
  if (error) throw new Error(error.message);
  if (confirmError) throw new Error(confirmError.message);
  const confirmed = new Set((confirmations ?? []).map((row) => row.profile_id as string));
  const usesConfirmation = Boolean(cup.confirm_deadline);
  const rows = (qualified ?? []).map((row) => ({
    profileId: row.profile_id as string,
    isSetter: Boolean(row.plays_as_setter),
  }));
  const pool = usesConfirmation ? rows.filter((row) => confirmed.has(row.profileId)) : rows;
  const readiness: DrawReadiness = {
    needed: cup.num_teams * cup.team_size,
    ready: pool.length,
    qualified: rows.length,
    usesConfirmation,
    setters: pool.filter((row) => row.isSetter).length,
  };
  return { pool, readiness };
}

/** Monta o sorteio com quem pode jogar e grava tudo escondido (nada é revelado ainda). */
export async function prepareCupDraw(supabase: SupabaseClient, cup: Cup) {
  const { pool, readiness } = await getDrawPool(supabase, cup);
  if (readiness.ready !== readiness.needed) {
    const who = readiness.usesConfirmation ? `${readiness.ready} confirmados (de ${readiness.qualified} classificados)` : `${readiness.ready} classificados`;
    throw new Error(`Para sortear são necessários ${readiness.needed} jogadores e hoje há ${who}.`);
  }

  const season = await getSeasonRanking(supabase, cup.community);
  const players = pool.map((row) => ({
    profileId: row.profileId,
    isSetter: row.isSetter,
    strength: season.get(row.profileId)?.averageIndex ?? 0,
  }));
  const picks = planDraw(players, cup.num_teams, cup.team_size);

  // Refaz do zero: placar e times antigos de um sorteio anterior saem junto.
  const { error: clearError } = await supabase.from("cup_teams").delete().eq("cup_id", cup.id);
  if (clearError) throw new Error(clearError.message);

  const identities = COPA_TEAMS.slice(0, cup.num_teams);
  if (identities.length < cup.num_teams) throw new Error("Há mais times na copa do que identidades cadastradas.");
  const { data: teams, error: teamsError } = await supabase
    .from("cup_teams")
    .insert(identities.map((team, index) => ({ cup_id: cup.id, slug: team.slug, name: team.name, position: index + 1 })))
    .select("id, position");
  if (teamsError) throw new Error(teamsError.message);
  const teamIdByIndex = new Map((teams ?? []).map((team) => [team.position - 1, team.id as string]));

  const { error: membersError } = await supabase.from("cup_team_members").insert(
    picks.map((pick) => ({
      cup_id: cup.id,
      team_id: teamIdByIndex.get(pick.teamIndex)!,
      profile_id: pick.profileId,
      pot: pick.pot,
      pick_order: pick.pickOrder,
    })),
  );
  if (membersError) throw new Error(membersError.message);
  return picks.length;
}

/** Revela a próxima escolha. Ao revelar a última, a tabela de jogos é criada e os jogadores avisados. */
export async function revealNextPick(supabase: SupabaseClient, cup: Cup) {
  const { data: next, error } = await supabase
    .from("cup_team_members")
    .select("id, pick_order")
    .eq("cup_id", cup.id)
    .is("revealed_at", null)
    .order("pick_order")
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!next) return { remaining: 0, finished: false };

  const { error: updateError } = await supabase
    .from("cup_team_members")
    .update({ revealed_at: new Date().toISOString() })
    .eq("id", next.id)
    .is("revealed_at", null);
  if (updateError) throw new Error(updateError.message);

  const { count } = await supabase
    .from("cup_team_members")
    .select("id", { count: "exact", head: true })
    .eq("cup_id", cup.id)
    .is("revealed_at", null);
  const remaining = count ?? 0;
  if (remaining === 0) {
    await createGroupFixtures(supabase, cup);
    await notifyTeams(supabase, cup);
  }
  return { remaining, finished: remaining === 0 };
}

export async function createGroupFixtures(supabase: SupabaseClient, cup: Cup) {
  const { data: teams } = await supabase.from("cup_teams").select("id, position").eq("cup_id", cup.id).order("position");
  if (!teams?.length) return;
  await supabase.from("cup_matches").delete().eq("cup_id", cup.id);
  const day = cup.final_date ?? new Date().toISOString().slice(0, 10);
  const { data: config } = await supabase.from("cups").select("day_start, match_minutes").eq("id", cup.id).maybeSingle();
  const dayStart = (config?.day_start as string | undefined) ?? "09:00";
  const minutes = (config?.match_minutes as number | undefined) ?? 30;

  const rows = roundRobin(teams.length).map((fixture) => ({
    cup_id: cup.id,
    stage: "group" as const,
    round: fixture.round,
    slot: fixture.slot,
    team_a_id: teams[fixture.teamA].id,
    team_b_id: teams[fixture.teamB].id,
    scheduled_at: scheduleAt(day, dayStart, minutes, fixture.slot - 1),
  }));
  const { error } = await supabase.from("cup_matches").insert(rows);
  if (error) throw new Error(error.message);
}

async function notifyTeams(supabase: SupabaseClient, cup: Cup) {
  const { teams, members } = await loadCupDay(supabase, cup.id);
  for (const team of teams) {
    const ids = members.filter((member) => member.team_id === team.id).map((member) => member.profile_id);
    await sendPushToProfiles(supabase, ids, {
      title: `Você ficou no time ${team.name}! 🏐`,
      body: `Sorteio da ${cup.name} concluído. Veja seu time e os horários dos jogos.`,
      url: `${COPA_PATH}/jogos`,
    });
  }
}

/** Salva o placar; terminando a fase de grupos, cria final e disputa de 3º sozinho. */
export async function saveCupScore(supabase: SupabaseClient, cup: Cup, matchId: string, scoreA: number, scoreB: number) {
  if (scoreA === scoreB) throw new Error("Não há empate no vôlei: confira o placar.");
  const { data: match, error } = await supabase.from("cup_matches").select("id, stage").eq("id", matchId).eq("cup_id", cup.id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!match) throw new Error("Jogo não encontrado.");
  const { error: updateError } = await supabase.from("cup_matches").update({ score_a: scoreA, score_b: scoreB }).eq("id", matchId);
  if (updateError) throw new Error(updateError.message);
  if (match.stage === "group") await createFinalsIfReady(supabase, cup);
}

export async function createFinalsIfReady(supabase: SupabaseClient, cup: Cup) {
  const { teams, matches } = await loadCupDay(supabase, cup.id);
  const groups = matches.filter((match) => match.stage === "group");
  if (!groups.length || groups.some((match) => match.score_a == null || match.score_b == null)) return false;
  if (matches.some((match) => match.stage !== "group")) return false;

  const order = computeStandings(
    teams.map((team) => team.id),
    groups.map((match) => ({ teamA: match.team_a_id, teamB: match.team_b_id, scoreA: match.score_a, scoreB: match.score_b })),
  );
  if (order.length < 4) return false;
  const { data: config } = await supabase.from("cups").select("day_start, match_minutes").eq("id", cup.id).maybeSingle();
  const day = cup.final_date ?? new Date().toISOString().slice(0, 10);
  const dayStart = (config?.day_start as string | undefined) ?? "09:00";
  const minutes = (config?.match_minutes as number | undefined) ?? 30;
  const base = groups.length;
  const { error } = await supabase.from("cup_matches").insert([
    { cup_id: cup.id, stage: "bronze", round: 4, slot: base + 1, team_a_id: order[2].teamId, team_b_id: order[3].teamId, scheduled_at: scheduleAt(day, dayStart, minutes, base) },
    { cup_id: cup.id, stage: "final", round: 5, slot: base + 2, team_a_id: order[0].teamId, team_b_id: order[1].teamId, scheduled_at: scheduleAt(day, dayStart, minutes, base + 1) },
  ]);
  if (error) throw new Error(error.message);
  return true;
}

export function cupChampion(teams: CupTeam[], matches: CupMatch[]) {
  const final = matches.find((match) => match.stage === "final");
  const winner = final ? matchWinner(final) : null;
  return winner ? (teams.find((team) => team.id === winner) ?? null) : null;
}

export { teamIdentity };
