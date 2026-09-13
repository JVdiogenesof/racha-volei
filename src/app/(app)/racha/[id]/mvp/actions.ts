"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrganizer } from "@/lib/auth";

export async function setMvp(formData: FormData) {
  await requireOrganizer();
  const supabase = await createClient();
  const eventId = String(formData.get("eventId"));
  const profileId = String(formData.get("profileId"));

  const { data: event } = await supabase.from("events").select("status").eq("id", eventId).maybeSingle();
  if (event?.status !== "finished") {
    throw new Error("Só dá pra escolher o Jogador Destaque depois que o racha for finalizado.");
  }

  const { data: attendance } = await supabase
    .from("attendance")
    .select("status")
    .eq("event_id", eventId)
    .eq("profile_id", profileId)
    .maybeSingle();
  if (attendance?.status !== "confirmed") {
    throw new Error("O Jogador Destaque precisa ser alguém confirmado nesse racha.");
  }

  const { error } = await supabase.from("events").update({ mvp_profile_id: profileId }).eq("id", eventId);
  if (error) throw new Error(error.message);
  revalidatePath(`/racha/${eventId}/mvp`);
  revalidatePath("/ranking");
}

export async function clearMvp(formData: FormData) {
  await requireOrganizer();
  const supabase = await createClient();
  const eventId = String(formData.get("eventId"));

  const { error } = await supabase.from("events").update({ mvp_profile_id: null }).eq("id", eventId);
  if (error) throw new Error(error.message);
  revalidatePath(`/racha/${eventId}/mvp`);
  revalidatePath("/ranking");
}
