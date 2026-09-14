"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { requireOrganizer } from "@/lib/auth";
import { sendPushToProfiles } from "@/lib/push";

export async function startEvent(formData: FormData) {
  await requireOrganizer();
  const supabase = await createClient();
  const eventId = String(formData.get("eventId"));

  const { data: event } = await supabase
    .from("events")
    .select("official_list_open")
    .eq("id", eventId)
    .maybeSingle();
  if (!event?.official_list_open) {
    throw new Error("Abra a lista oficial antes de iniciar o evento.");
  }

  const { error } = await supabase.from("events").update({ status: "in_progress" }).eq("id", eventId);
  if (error) throw new Error(error.message);

  revalidatePath(`/racha/${eventId}`);
  revalidatePath("/racha");
}

export async function finishEvent(formData: FormData) {
  const organizer = await requireOrganizer();
  const supabase = await createClient();
  const eventId = String(formData.get("eventId"));

  const { data: event, error } = await supabase
    .from("events")
    .update({ status: "finished" })
    .eq("id", eventId)
    .select("is_pre_torneio")
    .single();
  if (error) throw new Error(error.message);

  if (event.is_pre_torneio) {
    await reserveWinningTeam(supabase, eventId, organizer.id);
  }

  const { data: organizers } = await supabase
    .from("profiles")
    .select("id")
    .eq("is_organizer", true)
    .neq("id", organizer.id);
  await sendPushToProfiles(
    supabase,
    (organizers ?? []).map((p) => p.id),
    { title: "Racha finalizado!", body: "Escolha o Jogador Destaque.", url: `/racha/${eventId}/mvp` },
  );

  revalidatePath(`/racha/${eventId}`);
  revalidatePath(`/racha/${eventId}/mvp`);
  revalidatePath("/racha");
  revalidatePath("/torneios-vpa");
}

/**
 * Racha pré-torneio: o(s) time(s) com mais vitórias (empate reserva todos)
 * garantem vaga automática no próximo Torneios VPA. Sem vitórias
 * registradas, não reserva ninguém -- sem erro, só não faz nada.
 */
async function reserveWinningTeam(supabase: SupabaseClient, eventId: string, organizerId: string) {
  const { data: generation } = await supabase
    .from("team_generations")
    .select("id")
    .eq("event_id", eventId)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!generation) return;

  const { data: teamRows } = await supabase.from("teams").select("id").eq("generation_id", generation.id);
  const teamIds = (teamRows ?? []).map((t) => t.id);
  if (!teamIds.length) return;

  const { data: winRows } = await supabase.from("match_wins").select("team_id").eq("event_id", eventId);
  if (!winRows?.length) return;

  const winsByTeam = new Map<string, number>();
  for (const w of winRows) winsByTeam.set(w.team_id, (winsByTeam.get(w.team_id) ?? 0) + 1);

  const maxWins = Math.max(...winsByTeam.values());
  const winningTeamIds = teamIds.filter((id) => (winsByTeam.get(id) ?? 0) === maxWins);

  const { data: memberRows } = await supabase
    .from("team_members")
    .select("profile_id")
    .in("team_id", winningTeamIds);
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
      body: "Seu time venceu o racha pré-torneio! Você já tem vaga garantida no próximo Torneios VPA.",
      url: "/torneios-vpa",
    });
  }
}
