"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrganizer } from "@/lib/auth";
import { SKILL_CATEGORIES } from "@/lib/scoring";
import { RATING_WEIGHTS_ID } from "@/lib/ratings";

export async function setOrganizerRatings(formData: FormData) {
  const organizer = await requireOrganizer();
  const supabase = await createClient();
  const profileId = String(formData.get("profileId"));

  const rows = SKILL_CATEGORIES.map((category) => ({
    profile_id: profileId,
    category,
    value: Number(formData.get(category) ?? 2.5),
    rated_by: organizer.id,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from("organizer_ratings")
    .upsert(rows, { onConflict: "profile_id,category" });

  if (error) throw new Error(error.message);
  revalidatePath("/admin/jogadores");
}

export async function setRatingWeights(formData: FormData) {
  await requireOrganizer();
  const supabase = await createClient();

  const selfWeight = Number(formData.get("selfWeight") ?? 0.4);
  const organizerWeight = Number(formData.get("organizerWeight") ?? 0.6);

  const { error } = await supabase.from("rating_weights").upsert({
    id: RATING_WEIGHTS_ID,
    self_weight: selfWeight,
    organizer_weight: organizerWeight,
    updated_at: new Date().toISOString(),
  });

  if (error) throw new Error(error.message);
  revalidatePath("/admin/jogadores");
}
