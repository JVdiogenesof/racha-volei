"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrganizer } from "@/lib/auth";
import { getAllRatings, getRatingWeights } from "@/lib/ratings";
import { finalScoresForPlayer, overallScore } from "@/lib/scoring";
import { balanceTeams, type PlayerInput } from "@/lib/balanceTeams";

export async function generateTeams(formData: FormData) {
  const organizer = await requireOrganizer();
  const supabase = await createClient();
  const eventId = String(formData.get("eventId"));

  const { data: event } = await supabase
    .from("events")
    .select("num_teams, official_list_open")
    .eq("id", eventId)
    .maybeSingle();
  if (!event) throw new Error("Racha não encontrado.");
  if (!event.official_list_open) {
    throw new Error("Abra a lista oficial antes de gerar os times.");
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

  await supabase.from("events").update({ status: "teams_generated" }).eq("id", eventId);

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
