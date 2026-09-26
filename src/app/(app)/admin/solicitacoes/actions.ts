"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrganizer } from "@/lib/auth";
import { sendPushToProfiles } from "@/lib/push";

export async function approveProfile(formData: FormData) {
  const organizer = await requireOrganizer();
  const supabase = await createClient();
  const profileId = String(formData.get("profileId"));

  const { error } = await supabase
    .from("profiles")
    .update({ status: "approved", approved_by: organizer.id })
    .eq("id", profileId)
    .eq("status", "pending");

  if (error) throw new Error(error.message);

  await sendPushToProfiles(supabase, [profileId], {
    title: "Cadastro aprovado! 🏐",
    body: "Bem-vindo(a) ao racha! Seu acesso já está liberado.",
    url: "/",
  });

  revalidatePath("/admin/solicitacoes");
}

export async function rejectProfile(formData: FormData) {
  const organizer = await requireOrganizer();
  const supabase = await createClient();
  const profileId = String(formData.get("profileId"));

  const { error } = await supabase
    .from("profiles")
    .update({ status: "rejected", approved_by: organizer.id })
    .eq("id", profileId)
    .eq("status", "pending");

  if (error) throw new Error(error.message);
  revalidatePath("/admin/solicitacoes");
}
