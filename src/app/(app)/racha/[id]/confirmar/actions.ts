"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, requireOrganizer } from "@/lib/auth";

export async function setAttendance(formData: FormData) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const eventId = String(formData.get("eventId"));
  const status = String(formData.get("status")) as "confirmed" | "declined";

  const { data: event } = await supabase.from("events").select("status").eq("id", eventId).maybeSingle();
  if (event?.status === "finished") {
    throw new Error("Esse racha já terminou, não dá mais pra confirmar presença.");
  }
  if (event?.status === "cancelled") {
    throw new Error("Esse racha foi cancelado, não dá mais pra confirmar presença.");
  }

  const { error } = await supabase.from("attendance").upsert(
    {
      event_id: eventId,
      profile_id: profile.id,
      status,
      confirmed_at: new Date().toISOString(),
    },
    { onConflict: "event_id,profile_id" },
  );

  if (error) throw new Error(error.message);
  revalidatePath(`/racha/${eventId}/confirmar`);
  revalidatePath(`/racha/${eventId}`);
}

export async function removeAttendance(formData: FormData) {
  await requireOrganizer();
  const supabase = await createClient();
  const eventId = String(formData.get("eventId"));
  const profileId = String(formData.get("profileId"));

  const { error } = await supabase
    .from("attendance")
    .delete()
    .eq("event_id", eventId)
    .eq("profile_id", profileId);

  if (error) throw new Error(error.message);
  revalidatePath(`/racha/${eventId}/confirmar`);
  revalidatePath(`/racha/${eventId}`);
}
