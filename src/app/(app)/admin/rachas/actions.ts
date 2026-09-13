"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrganizer } from "@/lib/auth";
import { sendPushToProfiles } from "@/lib/push";

export async function createEvent(formData: FormData) {
  const organizer = await requireOrganizer();
  const supabase = await createClient();

  const date = String(formData.get("date") ?? "");
  const time = String(formData.get("time") ?? "") || null;
  const location = String(formData.get("location") ?? "").trim() || null;
  const numTeams = Number(formData.get("numTeams") ?? 2);
  const pricePerPlayerRaw = String(formData.get("pricePerPlayer") ?? "").trim();
  const pricePerPlayer = pricePerPlayerRaw ? Number(pricePerPlayerRaw) : null;
  const maxPlayersRaw = String(formData.get("maxPlayers") ?? "").trim();
  const maxPlayers = maxPlayersRaw ? Number(maxPlayersRaw) : null;

  if (!date || numTeams < 1) {
    throw new Error("Data e número de times são obrigatórios.");
  }

  const { data, error } = await supabase
    .from("events")
    .insert({
      date,
      time,
      location,
      num_teams: numTeams,
      price_per_player: pricePerPlayer,
      max_players: maxPlayers,
      created_by: organizer.id,
      official_list_open: false,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  const { data: approvedProfiles } = await supabase
    .from("profiles")
    .select("id")
    .eq("status", "approved")
    .neq("id", organizer.id);
  const dateLabel = new Date(`${date}T00:00:00`).toLocaleDateString("pt-BR");
  await sendPushToProfiles(
    supabase,
    (approvedProfiles ?? []).map((p) => p.id),
    { title: "Novo racha marcado!", body: `Racha de ${dateLabel}. Diga se você vai.`, url: `/racha/${data.id}` },
  );

  revalidatePath("/admin/rachas");
  revalidatePath("/racha");
  redirect(`/racha/${data.id}?criado=1`);
}

export async function updateEvent(formData: FormData) {
  await requireOrganizer();
  const supabase = await createClient();

  const eventId = String(formData.get("eventId"));
  const date = String(formData.get("date") ?? "");
  const time = String(formData.get("time") ?? "") || null;
  const location = String(formData.get("location") ?? "").trim() || null;
  const numTeams = Number(formData.get("numTeams") ?? 2);
  const pricePerPlayerRaw = String(formData.get("pricePerPlayer") ?? "").trim();
  const pricePerPlayer = pricePerPlayerRaw ? Number(pricePerPlayerRaw) : null;
  const maxPlayersRaw = String(formData.get("maxPlayers") ?? "").trim();
  const maxPlayers = maxPlayersRaw ? Number(maxPlayersRaw) : null;

  if (!date || numTeams < 1) {
    throw new Error("Data e número de times são obrigatórios.");
  }

  const { error } = await supabase
    .from("events")
    .update({
      date,
      time,
      location,
      num_teams: numTeams,
      price_per_player: pricePerPlayer,
      max_players: maxPlayers,
    })
    .eq("id", eventId);

  if (error) throw new Error(error.message);
  revalidatePath("/admin/rachas");
  revalidatePath("/racha");
  revalidatePath(`/racha/${eventId}`);
}

export async function cancelEvent(formData: FormData) {
  await requireOrganizer();
  const supabase = await createClient();
  const eventId = String(formData.get("eventId"));

  const { error } = await supabase.from("events").update({ status: "cancelled" }).eq("id", eventId);

  if (error) throw new Error(error.message);
  revalidatePath("/admin/rachas");
  revalidatePath("/racha");
  revalidatePath(`/racha/${eventId}`);
}

export async function deleteEvent(formData: FormData) {
  await requireOrganizer();
  const supabase = await createClient();
  const eventId = String(formData.get("eventId"));

  const { error } = await supabase.from("events").delete().eq("id", eventId);

  if (error) throw new Error(error.message);
  revalidatePath("/admin/rachas");
  revalidatePath("/racha");
}
