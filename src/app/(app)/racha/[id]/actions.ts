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

  const { error } = await supabase.from("events").update({ status: "finished" }).eq("id", eventId);
  if (error) throw new Error(error.message);

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

