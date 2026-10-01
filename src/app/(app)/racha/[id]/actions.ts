"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrganizer } from "@/lib/auth";
import { sendPushToProfiles } from "@/lib/push";

export async function startEvent(formData: FormData) {
  await requireOrganizer();
  const supabase = await createClient();
  const eventId = String(formData.get("eventId"));

  const { data: event } = await supabase
    .from("events")
    .select("official_list_open, status")
    .eq("id", eventId)
    .maybeSingle();
  if (!event?.official_list_open) {
    throw new Error("Abra a lista oficial antes de iniciar o evento.");
  }
  if (event.status !== "open" && event.status !== "teams_generated") {
    throw new Error("Esse racha não pode mais ser iniciado.");
  }

  const { error } = await supabase
    .from("events")
    .update({ status: "in_progress" })
    .eq("id", eventId)
    .in("status", ["open", "teams_generated"]);
  if (error) throw new Error(error.message);

  revalidatePath(`/racha/${eventId}`);
  revalidatePath("/racha");
}

export async function finishEvent(formData: FormData) {
  const organizer = await requireOrganizer();
  const supabase = await createClient();
  const eventId = String(formData.get("eventId"));

  const { data: finishedEvent, error } = await supabase
    .from("events")
    .update({ status: "finished" })
    .eq("id", eventId)
    .neq("status", "finished")
    .neq("status", "cancelled")
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!finishedEvent) throw new Error("Esse racha já foi finalizado ou cancelado.");

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
}

