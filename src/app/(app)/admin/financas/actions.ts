"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrganizer } from "@/lib/auth";
import { getActiveCommunity } from "@/lib/community";

const VALID_CREDIT_STATUSES = new Set(["used", "cancelled"]);

function requiredText(formData: FormData, key: string, label: string, maxLength: number) {
  const value = String(formData.get(key) ?? "").trim();
  if (!value) throw new Error(`${label} é obrigatório.`);
  if (value.length > maxLength) throw new Error(`${label} deve ter no máximo ${maxLength} caracteres.`);
  return value;
}

export async function grantFreeRachaCredits(formData: FormData) {
  const organizer = await requireOrganizer();
  const community = await getActiveCommunity(organizer);
  const profileId = requiredText(formData, "profileId", "Pessoa", 50);
  const reason = requiredText(formData, "reason", "Motivo", 120);
  const notes = String(formData.get("notes") ?? "").trim();
  const quantity = Number(formData.get("quantity") ?? 1);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) throw new Error("A quantidade deve ficar entre 1 e 10.");
  if (notes.length > 500) throw new Error("A observação deve ter no máximo 500 caracteres.");

  const supabase = await createClient();
  const { data: target, error: targetError } = await supabase
    .from("profiles")
    .select("id, communities")
    .eq("id", profileId)
    .contains("communities", [community])
    .maybeSingle();
  if (targetError) throw new Error(targetError.message);
  if (!target) throw new Error("Essa pessoa não pertence à modalidade selecionada.");

  const rows = Array.from({ length: quantity }, () => ({
    profile_id: profileId,
    community,
    reason,
    notes: notes || null,
    granted_by: organizer.id,
  }));
  const { data, error } = await supabase.from("free_racha_credits").insert(rows).select("id");
  if (error) throw new Error(error.message);
  if (data?.length !== quantity) throw new Error("Nem todos os créditos foram registrados.");
  revalidatePath("/admin/financas");
}

export async function useFreeRachaCredit(formData: FormData) {
  const organizer = await requireOrganizer();
  const community = await getActiveCommunity(organizer);
  const creditId = requiredText(formData, "creditId", "Crédito", 50);
  const eventId = String(formData.get("eventId") ?? "").trim();
  const supabase = await createClient();

  if (eventId) {
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id")
      .eq("id", eventId)
      .eq("community", community)
      .maybeSingle();
    if (eventError) throw new Error(eventError.message);
    if (!event) throw new Error("Racha não encontrado nesta modalidade.");
  }

  const { data, error } = await supabase
    .from("free_racha_credits")
    .update({ status: "used", used_event_id: eventId || null, used_by: organizer.id, used_at: new Date().toISOString() })
    .eq("id", creditId)
    .eq("community", community)
    .eq("status", "available")
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Este crédito não está mais disponível.");
  revalidatePath("/admin/financas");
}

export async function cancelFreeRachaCredit(formData: FormData) {
  const organizer = await requireOrganizer();
  const community = await getActiveCommunity(organizer);
  const creditId = requiredText(formData, "creditId", "Crédito", 50);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("free_racha_credits")
    .update({ status: "cancelled", cancelled_by: organizer.id, cancelled_at: new Date().toISOString() })
    .eq("id", creditId)
    .eq("community", community)
    .eq("status", "available")
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Este crédito não está mais disponível.");
  revalidatePath("/admin/financas");
}

export async function restoreFreeRachaCredit(formData: FormData) {
  const organizer = await requireOrganizer();
  const community = await getActiveCommunity(organizer);
  const creditId = requiredText(formData, "creditId", "Crédito", 50);
  const previousStatus = String(formData.get("previousStatus") ?? "");
  if (!VALID_CREDIT_STATUSES.has(previousStatus)) throw new Error("Situação inválida para restauração.");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("free_racha_credits")
    .update({ status: "available", used_event_id: null, used_by: null, used_at: null, cancelled_by: null, cancelled_at: null })
    .eq("id", creditId)
    .eq("community", community)
    .eq("status", previousStatus)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("O crédito já foi alterado por outro administrador.");
  revalidatePath("/admin/financas");
}
