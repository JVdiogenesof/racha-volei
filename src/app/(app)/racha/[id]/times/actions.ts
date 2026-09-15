"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { requireOrganizer } from "@/lib/auth";
import { getAllRatings, getRatingWeights } from "@/lib/ratings";
import { finalScoresForPlayer, overallScore } from "@/lib/scoring";
import { balanceTeams, type PlayerInput } from "@/lib/balanceTeams";
import { generateRoundRobinPairs, computeStandings } from "@/lib/torneioStandings";
import { sendPushToProfiles } from "@/lib/push";

export async function generateTeams(formData: FormData) {
  const organizer = await requireOrganizer();
  const supabase = await createClient();
  const eventId = String(formData.get("eventId"));

  const { data: event } = await supabase
    .from("events")
    .select("date, num_teams, official_list_open, is_pre_torneio")
    .eq("id", eventId)
    .maybeSingle();
  if (!event) throw new Error("Racha não encontrado.");
  if (!event.official_list_open) {
    throw new Error("Abra a lista oficial antes de gerar os times.");
  }

  if (event.is_pre_torneio) {
    const { count: playedCount } = await supabase
      .from("tournament_matches")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId)
      .not("score_a", "is", null);
    if (playedCount) {
      throw new Error(
        'Já tem placar lançado na fase de grupos desse pré-torneio. Use "Reiniciar fase de grupos" antes de gerar os times de novo.',
      );
    }
  }

  const { data: confirmed } = await supabase
    .from("attendance")
    .select("profile_id, profiles(is_setter)")
    .eq("event_id", eventId)
    .eq("status", "confirmed");

  if (!confirmed?.length) throw new Error("Nenhum jogador confirmado ainda.");

  const [{ selfByProfile, organizerByProfile }, weights] = await Promise.all([
    getAllRatings(supabase),
    getRatingWeights(supabase),
  ]);

  const players: PlayerInput[] = confirmed.map((row) => {
    const self = selfByProfile.get(row.profile_id) ?? {};
    const organizer = organizerByProfile.get(row.profile_id) ?? {};
    const scores = finalScoresForPlayer(self, organizer, weights.selfWeight, weights.organizerWeight);
    const isSetter = (row.profiles as unknown as { is_setter: boolean } | null)?.is_setter ?? false;
    return {
      profileId: row.profile_id,
      overall: overallScore(scores),
      settingScore: scores.setting,
      isSetter,
    };
  });

  const result = balanceTeams(players, event.num_teams);

  const { data: generation, error: genError } = await supabase
    .from("team_generations")
    .insert({ event_id: eventId, generated_by: organizer.id })
    .select("id")
    .single();
  if (genError) throw new Error(genError.message);

  const { data: teamRows, error: teamsError } = await supabase
    .from("teams")
    .insert(
      result.map((t) => ({ generation_id: generation.id, team_number: t.teamNumber })),
    )
    .select("id, team_number");
  if (teamsError) throw new Error(teamsError.message);

  const teamIdByNumber = new Map(teamRows.map((t) => [t.team_number, t.id]));
  const memberRows = result.flatMap((t) =>
    t.memberProfileIds.map((profileId) => ({
      team_id: teamIdByNumber.get(t.teamNumber)!,
      profile_id: profileId,
    })),
  );

  const { error: membersError } = await supabase.from("team_members").insert(memberRows);
  if (membersError) throw new Error(membersError.message);

  if (event.is_pre_torneio) {
    // Sem placar lançado (checado acima), então é seguro limpar e recriar
    // os confrontos de grupo pros times novos.
    await supabase.from("tournament_matches").delete().eq("event_id", eventId);
    const newTeamIds = teamRows.map((t) => t.id);
    const pairs = generateRoundRobinPairs(newTeamIds);
    const { error: matchesError } = await supabase
      .from("tournament_matches")
      .insert(pairs.map(([teamAId, teamBId]) => ({ event_id: eventId, team_a_id: teamAId, team_b_id: teamBId, stage: "group" })));
    if (matchesError) throw new Error(matchesError.message);
  }

  await supabase.from("events").update({ status: "teams_generated" }).eq("id", eventId);

  const dateLabel = new Date(`${event.date}T00:00:00`).toLocaleDateString("pt-BR");
  await sendPushToProfiles(
    supabase,
    players.map((p) => p.profileId).filter((id) => id !== organizer.id),
    { title: "Os times já estão prontos!", body: `Confira os times do racha de ${dateLabel}.`, url: `/racha/${eventId}/times` },
  );

  revalidatePath(`/racha/${eventId}/times`);
}

export async function addToTeam(formData: FormData) {
  await requireOrganizer();
  const supabase = await createClient();
  const eventId = String(formData.get("eventId"));
  const teamId = String(formData.get("teamId"));
  const profileId = String(formData.get("profileId"));

  // Pra completar um time que ficou com menos gente (ex: alguém saiu e ainda
  // não tinha substituto) sem precisar "substituir" ninguém que já está lá.
  const { error } = await supabase.from("team_members").insert({ team_id: teamId, profile_id: profileId });

  if (error) throw new Error(error.message);
  revalidatePath(`/racha/${eventId}/times`);
}

export async function moveMember(formData: FormData) {
  await requireOrganizer();
  const supabase = await createClient();
  const eventId = String(formData.get("eventId"));
  const teamMemberId = String(formData.get("teamMemberId"));
  const targetTeamId = String(formData.get("targetTeamId"));

  const { error } = await supabase
    .from("team_members")
    .update({ team_id: targetTeamId })
    .eq("id", teamMemberId);

  if (error) throw new Error(error.message);
  revalidatePath(`/racha/${eventId}/times`);
}

export async function swapMembers(formData: FormData) {
  await requireOrganizer();
  const supabase = await createClient();
  const eventId = String(formData.get("eventId"));
  const memberIdA = String(formData.get("teamMemberId"));
  const memberIdB = String(formData.get("swapWithTeamMemberId"));

  if (!memberIdB || memberIdA === memberIdB) return;

  const { data: rows, error: fetchError } = await supabase
    .from("team_members")
    .select("id, team_id")
    .in("id", [memberIdA, memberIdB]);
  if (fetchError) throw new Error(fetchError.message);

  const a = rows?.find((r) => r.id === memberIdA);
  const b = rows?.find((r) => r.id === memberIdB);
  if (!a || !b) throw new Error("Jogador não encontrado.");
  if (a.team_id === b.team_id) throw new Error("Esses dois jogadores já estão no mesmo time.");

  const { error: e1 } = await supabase.from("team_members").update({ team_id: b.team_id }).eq("id", a.id);
  if (e1) throw new Error(e1.message);

  const { error: e2 } = await supabase.from("team_members").update({ team_id: a.team_id }).eq("id", b.id);
  if (e2) throw new Error(e2.message);

  revalidatePath(`/racha/${eventId}/times`);
}

export async function replaceMember(formData: FormData) {
  await requireOrganizer();
  const supabase = await createClient();
  const eventId = String(formData.get("eventId"));
  const teamMemberId = String(formData.get("teamMemberId"));
  const newProfileId = String(formData.get("newProfileId"));

  // Cobre o caso de alguém sair da lista de confirmados depois dos times já
  // gerados: quem entrou no lugar dela nunca teve uma linha em team_members,
  // então não dava pra "trocar" com ela (swapMembers exige as duas linhas já
  // existirem) — aqui só troca o dono do lugar que já existe no time.
  const { error } = await supabase.from("team_members").update({ profile_id: newProfileId }).eq("id", teamMemberId);

  if (error) throw new Error(error.message);
  revalidatePath(`/racha/${eventId}/times`);
}

export async function removeFromTeam(formData: FormData) {
  await requireOrganizer();
  const supabase = await createClient();
  const eventId = String(formData.get("eventId"));
  const teamMemberId = String(formData.get("teamMemberId"));

  // Cobre o caso de alguém sair da lista de confirmados depois dos times já
  // gerados e ainda não ter ninguém pra colocar no lugar — aí não dá pra
  // "substituir", só sobra tirar ela do time mesmo.
  const { error } = await supabase.from("team_members").delete().eq("id", teamMemberId);

  if (error) throw new Error(error.message);
  revalidatePath(`/racha/${eventId}/times`);
}

export async function recordMatchWin(formData: FormData) {
  const organizer = await requireOrganizer();
  const supabase = await createClient();
  const eventId = String(formData.get("eventId"));
  const teamId = String(formData.get("teamId"));

  const { error } = await supabase.from("match_wins").insert({
    event_id: eventId,
    team_id: teamId,
    recorded_by: organizer.id,
  });

  if (error) throw new Error(error.message);
  revalidatePath(`/racha/${eventId}/times`);
  revalidatePath("/ranking");
}

export async function undoLastMatchWin(formData: FormData) {
  await requireOrganizer();
  const supabase = await createClient();
  const eventId = String(formData.get("eventId"));
  const teamId = String(formData.get("teamId"));

  const { data: last } = await supabase
    .from("match_wins")
    .select("id")
    .eq("event_id", eventId)
    .eq("team_id", teamId)
    .order("recorded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (last) {
    const { error } = await supabase.from("match_wins").delete().eq("id", last.id);
    if (error) throw new Error(error.message);
  }
  revalidatePath(`/racha/${eventId}/times`);
  revalidatePath("/ranking");
}

/**
 * Depois que todo mundo jogou a fase de grupos (todos os confrontos "group"
 * com placar), calcula a classificação e cria o confronto da final com o
 * 1º e o 2º colocado -- só se a final ainda não existir.
 */
async function maybeCreateFinal(supabase: SupabaseClient, eventId: string) {
  const { data: groupMatches } = await supabase
    .from("tournament_matches")
    .select("id, team_a_id, team_b_id, score_a, score_b")
    .eq("event_id", eventId)
    .eq("stage", "group");
  if (!groupMatches?.length) return;
  if (!groupMatches.every((m) => m.score_a != null && m.score_b != null)) return;

  const { data: existingFinal } = await supabase
    .from("tournament_matches")
    .select("id")
    .eq("event_id", eventId)
    .eq("stage", "final")
    .maybeSingle();
  if (existingFinal) return;

  const teamIds = [...new Set(groupMatches.flatMap((m) => [m.team_a_id, m.team_b_id]))];
  const { data: teamRows } = await supabase.from("teams").select("id, team_number").in("id", teamIds);
  const standings = computeStandings(
    (teamRows ?? []).map((t) => ({ id: t.id, teamNumber: t.team_number })),
    groupMatches.map((m) => ({ teamAId: m.team_a_id, teamBId: m.team_b_id, scoreA: m.score_a, scoreB: m.score_b })),
  );
  const [first, second] = standings;
  if (!first || !second) return;

  const { error } = await supabase
    .from("tournament_matches")
    .insert({ event_id: eventId, team_a_id: first.teamId, team_b_id: second.teamId, stage: "final" });
  if (error) throw new Error(error.message);
}

/**
 * Final decidida: o time campeão garante as 6 vagas no Torneio VPA -- mesmo
 * padrão de upsert + push que existia em reserveWinningTeam (racha/[id]/actions.ts),
 * só que disparado na hora que a final é lançada em vez de no fim do racha.
 */
async function reserveChampionTeam(supabase: SupabaseClient, eventId: string, matchId: string, organizerId: string) {
  const { data: match } = await supabase
    .from("tournament_matches")
    .select("team_a_id, team_b_id, score_a, score_b")
    .eq("id", matchId)
    .maybeSingle();
  if (!match || match.score_a == null || match.score_b == null) return;

  const championTeamId = match.score_a > match.score_b ? match.team_a_id : match.team_b_id;

  const { data: memberRows } = await supabase
    .from("team_members")
    .select("profile_id")
    .eq("team_id", championTeamId);
  const profileIds = [...new Set((memberRows ?? []).map((m) => m.profile_id))];
  if (!profileIds.length) return;

  const { data: reserved } = await supabase
    .from("tournament_reserved_players")
    .upsert(
      profileIds.map((profileId) => ({ profile_id: profileId, source_event_id: eventId, added_by: organizerId })),
      { onConflict: "profile_id", ignoreDuplicates: true },
    )
    .select("profile_id");

  const newlyReservedIds = (reserved ?? []).map((r) => r.profile_id);
  if (newlyReservedIds.length) {
    await sendPushToProfiles(supabase, newlyReservedIds, {
      title: "Vaga garantida! 🏆",
      body: "Seu time venceu a final do pré-torneio! Você já tem vaga garantida no próximo Torneio VPA.",
      url: "/torneios-vpa",
    });
  }
}

export async function recordTournamentMatchScore(formData: FormData) {
  const organizer = await requireOrganizer();
  const supabase = await createClient();
  const eventId = String(formData.get("eventId"));
  const matchId = String(formData.get("matchId"));
  const scoreA = Number(formData.get("scoreA"));
  const scoreB = Number(formData.get("scoreB"));

  if (!Number.isFinite(scoreA) || !Number.isFinite(scoreB) || scoreA < 0 || scoreB < 0) {
    throw new Error("Placar inválido.");
  }
  if (scoreA === scoreB) {
    throw new Error("Vôlei não empata — os placares não podem ser iguais.");
  }

  const { data: match, error: matchError } = await supabase
    .from("tournament_matches")
    .select("id, stage")
    .eq("id", matchId)
    .maybeSingle();
  if (matchError) throw new Error(matchError.message);
  if (!match) throw new Error("Confronto não encontrado.");

  const { error } = await supabase
    .from("tournament_matches")
    .update({ score_a: scoreA, score_b: scoreB, played_at: new Date().toISOString() })
    .eq("id", matchId);
  if (error) throw new Error(error.message);

  if (match.stage === "group") {
    await maybeCreateFinal(supabase, eventId);
  } else {
    await reserveChampionTeam(supabase, eventId, matchId, organizer.id);
  }

  revalidatePath(`/racha/${eventId}/times`);
  revalidatePath("/torneios-vpa");
}

/**
 * Apaga todos os confrontos (grupo e final) desse pré-torneio e gera a fase
 * de grupos de novo a partir dos times atuais -- e desfaz qualquer vaga já
 * reservada a partir desse racha, já que a final (se existia) some junto.
 */
export async function resetGroupStage(formData: FormData) {
  await requireOrganizer();
  const supabase = await createClient();
  const eventId = String(formData.get("eventId"));

  const { data: generation } = await supabase
    .from("team_generations")
    .select("id")
    .eq("event_id", eventId)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!generation) throw new Error("Gere os times antes de reiniciar a fase de grupos.");

  const { data: teamRows } = await supabase.from("teams").select("id").eq("generation_id", generation.id);
  const teamIds = (teamRows ?? []).map((t) => t.id);
  if (!teamIds.length) throw new Error("Nenhum time encontrado pra esse racha.");

  await supabase.from("tournament_reserved_players").delete().eq("source_event_id", eventId);
  await supabase.from("tournament_matches").delete().eq("event_id", eventId);

  const pairs = generateRoundRobinPairs(teamIds);
  const { error } = await supabase
    .from("tournament_matches")
    .insert(pairs.map(([teamAId, teamBId]) => ({ event_id: eventId, team_a_id: teamAId, team_b_id: teamBId, stage: "group" })));
  if (error) throw new Error(error.message);

  revalidatePath(`/racha/${eventId}/times`);
  revalidatePath("/torneios-vpa");
}

/**
 * Desfaz só a final (mantém os placares de grupo). Se ela já tinha placar,
 * desfaz também a reserva de vaga que veio desse racha -- reserva manual ou
 * vinda de outro pré-torneio não é tocada. Na próxima vez que um placar de
 * grupo for salvo, maybeCreateFinal recria a final com o 1º/2º corretos.
 */
export async function undoFinal(formData: FormData) {
  await requireOrganizer();
  const supabase = await createClient();
  const eventId = String(formData.get("eventId"));

  const { data: final } = await supabase
    .from("tournament_matches")
    .select("id, score_a, score_b")
    .eq("event_id", eventId)
    .eq("stage", "final")
    .maybeSingle();
  if (!final) return;

  if (final.score_a != null && final.score_b != null) {
    await supabase.from("tournament_reserved_players").delete().eq("source_event_id", eventId);
  }

  const { error } = await supabase.from("tournament_matches").delete().eq("id", final.id);
  if (error) throw new Error(error.message);

  revalidatePath(`/racha/${eventId}/times`);
  revalidatePath("/torneios-vpa");
}
