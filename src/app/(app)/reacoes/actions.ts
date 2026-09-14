"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { sendPushToProfiles } from "@/lib/push";
import { renderReactionText } from "@/lib/reactions";

export async function sendReaction(formData: FormData) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const toProfileId = String(formData.get("toProfileId") ?? "");
  const reactionTypeId = String(formData.get("reactionTypeId") ?? "");

  if (!toProfileId || !reactionTypeId) {
    throw new Error("Escolha quem vai receber e qual reação mandar.");
  }

  const [{ data: target }, { data: reactionType }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", toProfileId).maybeSingle(),
    supabase.from("reaction_types").select("text, active").eq("id", reactionTypeId).maybeSingle(),
  ]);
  if (!target) throw new Error("Jogador não encontrado.");
  if (!reactionType?.active) throw new Error("Essa reação não está mais disponível.");

  const { error } = await supabase.from("reactions").insert({
    from_profile_id: profile.id,
    to_profile_id: toProfileId,
    reaction_type_id: reactionTypeId,
  });
  if (error) throw new Error(error.message);

  if (toProfileId !== profile.id) {
    await sendPushToProfiles(supabase, [toProfileId], {
      title: "Você recebeu uma reação! 🎭",
      body: `${profile.full_name} ${renderReactionText(reactionType.text, target.full_name)}`,
      url: "/reacoes",
    });
  }

  revalidatePath("/reacoes");
}

export async function deleteReaction(formData: FormData) {
  await requireProfile();
  const supabase = await createClient();
  const reactionId = String(formData.get("reactionId"));

  // RLS já garante que só quem mandou ou um organizador consegue apagar.
  const { error } = await supabase.from("reactions").delete().eq("id", reactionId);
  if (error) throw new Error(error.message);
  revalidatePath("/reacoes");
}
