"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";

export async function voteMvp(formData: FormData) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const eventId = String(formData.get("eventId"));
  const votedForProfileId = String(formData.get("votedForProfileId"));

  const { error } = await supabase.from("mvp_votes").insert({
    event_id: eventId,
    voter_profile_id: profile.id,
    voted_for_profile_id: votedForProfileId,
  });

  if (error) throw new Error(error.message);
  revalidatePath(`/racha/${eventId}/mvp`);
}
