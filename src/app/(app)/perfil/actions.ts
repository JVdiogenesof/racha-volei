"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { SKILL_CATEGORIES } from "@/lib/scoring";

export async function updateProfileData(formData: FormData) {
  const profile = await requireProfile();
  const supabase = await createClient();

  const fullName = String(formData.get("fullName") ?? "").trim();
  const birthdate = String(formData.get("birthdate") ?? "");
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const isSetter = formData.get("isSetter") === "on";

  if (!fullName || !birthdate) {
    throw new Error("Nome e data de aniversário são obrigatórios.");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const avatarUrl =
    (user?.user_metadata?.avatar_url as string | undefined) ??
    (user?.user_metadata?.picture as string | undefined) ??
    null;

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName, birthdate, phone, is_setter: isSetter, avatar_url: avatarUrl })
    .eq("id", profile.id);

  if (error) throw new Error(error.message);
  revalidatePath("/perfil");
}

export async function updateSelfRatings(formData: FormData) {
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
  revalidatePath("/perfil");
}
