"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrganizer } from "@/lib/auth";

export async function setPaymentStatus(formData: FormData) {
  const organizer = await requireOrganizer();
  const supabase = await createClient();
  const eventId = String(formData.get("eventId"));
  const profileId = String(formData.get("profileId"));
  const paid = formData.get("paid") === "true";

  const { error } = await supabase.from("payments").upsert(
    {
      event_id: eventId,
      profile_id: profileId,
      paid,
      paid_at: paid ? new Date().toISOString() : null,
      marked_by: organizer.id,
    },
    { onConflict: "event_id,profile_id" },
  );

  if (error) throw new Error(error.message);
  revalidatePath(`/racha/${eventId}/pagamentos`);
}
