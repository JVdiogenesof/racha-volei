"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrganizer } from "@/lib/auth";

const VALID_METRICS = ["attendance", "mvp", "wins"];

export async function adjustRanking(formData: FormData) {
  const organizer = await requireOrganizer();
  const supabase = await createClient();
  const profileId = String(formData.get("profileId"));
  const metric = String(formData.get("metric"));
  const delta = Number(formData.get("delta"));

  if (!VALID_METRICS.includes(metric)) {
    throw new Error("Métrica inválida.");
  }
  if (!Number.isInteger(delta) || delta === 0) {
    throw new Error("Ajuste inválido.");
  }

  const { error } = await supabase.from("ranking_adjustments").insert({
    profile_id: profileId,
    metric,
    delta,
    created_by: organizer.id,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/admin/ranking");
  revalidatePath("/ranking");
}

export async function deleteRankingAdjustment(formData: FormData) {
  await requireOrganizer();
  const supabase = await createClient();
  const id = String(formData.get("id"));

  const { error } = await supabase.from("ranking_adjustments").delete().eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/admin/ranking");
  revalidatePath("/ranking");
}
