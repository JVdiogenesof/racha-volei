"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrganizer } from "@/lib/auth";

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
  await requireOrganizer();
  const supabase = await createClient();
  const eventId = String(formData.get("eventId"));

  const { error } = await supabase.from("events").update({ status: "finished" }).eq("id", eventId);
  if (error) throw new Error(error.message);

  revalidatePath(`/racha/${eventId}`);
  revalidatePath(`/racha/${eventId}/mvp`);
  revalidatePath("/racha");
}
