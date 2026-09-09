"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrganizer } from "@/lib/auth";

export async function createEvent(formData: FormData) {
  const organizer = await requireOrganizer();
  const supabase = await createClient();

  const date = String(formData.get("date") ?? "");
  const time = String(formData.get("time") ?? "") || null;
  const location = String(formData.get("location") ?? "").trim() || null;
  const numTeams = Number(formData.get("numTeams") ?? 2);
  const pricePerPlayerRaw = String(formData.get("pricePerPlayer") ?? "").trim();
  const pricePerPlayer = pricePerPlayerRaw ? Number(pricePerPlayerRaw) : null;

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
      created_by: organizer.id,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
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
