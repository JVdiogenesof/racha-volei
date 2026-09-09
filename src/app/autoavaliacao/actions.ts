"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { SKILL_CATEGORIES } from "@/lib/scoring";

export async function submitSelfRatings(formData: FormData) {
  const profile = await requireProfile();
  const supabase = await createClient();

  const rows = SKILL_CATEGORIES.map((category) => ({
    profile_id: profile.id,
    category,
    value: Number(formData.get(category) ?? 2.5),
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from("self_ratings")
    .upsert(rows, { onConflict: "profile_id,category" });

  if (error) throw new Error(error.message);
  redirect("/");
}
