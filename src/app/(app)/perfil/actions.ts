"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireMember } from "@/lib/auth";
import { SKILL_CATEGORIES } from "@/lib/scoring";

export async function updateProfileData(formData: FormData) {
  const profile = await requireMember();
  const supabase = await createClient();

  const fullName = String(formData.get("fullName") ?? "").trim();
  const birthdate = String(formData.get("birthdate") ?? "");
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const nicknameBadge = String(formData.get("nicknameBadge") ?? "").trim().slice(0, 40) || null;
  const isSetter = formData.get("position") === "setter";
  const attendanceFrequency = String(formData.get("attendanceFrequency") ?? "weekly");
  const hasVpaShirt = formData.get("hasVpaShirt") === "on";
  const wantsTournaments = formData.get("wantsTournaments") === "on";
  const playerLevel = String(formData.get("playerLevel") ?? "");

  if (!fullName || !birthdate || !["beginner", "intermediate", "advanced"].includes(playerLevel)) {
    throw new Error("Nome, data de aniversário e nível são obrigatórios.");
  }

  // avatar_url não entra aqui de propósito: é definido no cadastro (foto do
  // Google) e pode ser trocado por um organizador em /admin/jogadores — se
  // resincronizasse com o Google a cada save, apagaria a foto trocada pelo
  // organizador.
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: fullName,
      birthdate,
      phone,
      nickname_badge: nicknameBadge,
      is_setter: isSetter,
      attendance_frequency: attendanceFrequency,
      has_vpa_shirt: hasVpaShirt,
      wants_tournaments: wantsTournaments,
      player_level: playerLevel,
    })
    .eq("id", profile.id);

  if (error) throw new Error(error.message);
  revalidatePath("/perfil");
  revalidatePath("/perfil/dados");
  revalidatePath("/jogadores");
}

export async function updateSelfRatings(formData: FormData) {
  const profile = await requireMember();
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
  revalidatePath("/perfil/autoavaliacao");
}

export async function savePushSubscription(subscription: { endpoint: string; keys: { p256dh: string; auth: string } }) {
  const profile = await requireMember();
  const supabase = await createClient();

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      profile_id: profile.id,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
    { onConflict: "endpoint" },
  );

  if (error) throw new Error(error.message);
}

export async function deletePushSubscription(endpoint: string) {
  await requireMember();
  const supabase = await createClient();

  const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  if (error) throw new Error(error.message);
}
