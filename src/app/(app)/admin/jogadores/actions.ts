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

export async function updatePlayerProfile(formData: FormData) {
  await requireOrganizer();
  const supabase = await createClient();
  const profileId = String(formData.get("profileId"));
  const fullName = String(formData.get("fullName") ?? "").trim();
  const nicknameBadge = String(formData.get("nicknameBadge") ?? "").trim().slice(0, 40) || null;

  if (!fullName) throw new Error("O nome não pode ficar em branco.");

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName, nickname_badge: nicknameBadge })
    .eq("id", profileId);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/jogadores");
  revalidatePath("/jogadores");
  revalidatePath("/ranking");
}

export async function removeMember(formData: FormData) {
  const organizer = await requireOrganizer();
  const supabase = await createClient();
  const profileId = String(formData.get("profileId"));

  if (profileId === organizer.id) {
    throw new Error("Você não pode remover a si mesmo.");
  }

  const { data: target } = await supabase
    .from("profiles")
    .select("is_organizer")
    .eq("id", profileId)
    .maybeSingle();
  if (target?.is_organizer) {
    throw new Error("Não dá pra remover outro organizador por aqui.");
  }

  const { error } = await supabase.from("profiles").update({ status: "removed" }).eq("id", profileId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/jogadores");
  revalidatePath("/jogadores");
  revalidatePath("/ranking");
}

export async function restoreMember(formData: FormData) {
  await requireOrganizer();
  const supabase = await createClient();
  const profileId = String(formData.get("profileId"));

  const { data: restored, error } = await supabase
    .from("profiles")
    .update({ status: "approved" })
    .eq("id", profileId)
    .eq("status", "removed")
    .select("id")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!restored) throw new Error("Essa pessoa não está mais na lista de removidos.");

  revalidatePath("/admin/jogadores");
  revalidatePath("/jogadores");
  revalidatePath("/ranking");
  revalidatePath("/");
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
