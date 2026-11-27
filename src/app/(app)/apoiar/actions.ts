"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrganizer } from "@/lib/auth";

function parseGoal(raw: FormDataEntryValue | null) {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  const value = Number(text.replace(/[^\d,.]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
  if (!Number.isFinite(value) || value <= 0) return "invalid" as const;
  return Math.round(value * 100) / 100;
}

export async function createDonationCampaign(formData: FormData) {
  const organizer = await requireOrganizer("admin");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const goal = parseGoal(formData.get("goal"));
  if (title.length < 2) return "Dê um nome para a campanha.";
  if (title.length > 80) return "O nome pode ter até 80 letras.";
  if (description.length > 600) return "A descrição pode ter até 600 letras.";
  if (goal === "invalid") return "A meta precisa ser um valor maior que zero.";

  const supabase = await createClient();
  const { error } = await supabase.from("donation_campaigns").insert({
    title,
    description: description || null,
    goal_amount: goal,
    created_by: organizer.id,
  });
  if (error) {
    console.error("[doacao-campanha] Falha ao criar", error.message);
    return "Não foi possível criar a campanha.";
  }
  revalidatePath("/apoiar");
  revalidatePath("/");
}

export async function updateDonationCampaign(formData: FormData) {
  await requireOrganizer("admin");
  const id = String(formData.get("campaignId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const goal = parseGoal(formData.get("goal"));
  if (!id) return "Campanha inválida.";
  if (title.length < 2 || title.length > 80) return "O nome precisa ter de 2 a 80 letras.";
  if (description.length > 600) return "A descrição pode ter até 600 letras.";
  if (goal === "invalid") return "A meta precisa ser um valor maior que zero.";

  const supabase = await createClient();
  const { error } = await supabase
    .from("donation_campaigns")
    .update({ title, description: description || null, goal_amount: goal, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    console.error("[doacao-campanha] Falha ao editar", error.message);
    return "Não foi possível salvar a campanha.";
  }
  revalidatePath("/apoiar");
  revalidatePath("/");
}

export async function setDonationCampaignActive(formData: FormData) {
  await requireOrganizer("admin");
  const id = String(formData.get("campaignId") ?? "");
  const active = String(formData.get("active")) === "true";
  if (!id) return "Campanha inválida.";
  const supabase = await createClient();
  const { error } = await supabase
    .from("donation_campaigns")
    .update({ active, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("is_general", false);
  if (error) {
    console.error("[doacao-campanha] Falha ao mudar status", error.message);
    return "Não foi possível mudar a campanha.";
  }
  revalidatePath("/apoiar");
  revalidatePath("/");
  return active ? "Campanha reaberta!" : "Campanha encerrada.";
}
