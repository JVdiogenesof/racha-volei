"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";

export async function setAttendance(formData: FormData) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const eventId = String(formData.get("eventId"));
  const status = String(formData.get("status")) as "confirmed" | "declined";

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
