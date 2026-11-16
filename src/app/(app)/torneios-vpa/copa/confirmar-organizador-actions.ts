"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrganizer } from "@/lib/auth";
import { COPA_PATH } from "@/lib/copaVpa";
import { markCupPaymentRefunded } from "@/lib/copaConfirm";

function requiredId(formData: FormData, key: string, label: string) {
  const value = String(formData.get(key) ?? "").trim();
  if (!value) throw new Error(`Escolha ${label}.`);
  return value;
}

/** Prazo digitado em horário de Brasília (datetime-local, sem fuso). */
function parseDeadline(raw: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)) throw new Error("Prazo inválido.");
  const date = new Date(`${raw}:00-03:00`);
  if (Number.isNaN(date.getTime())) throw new Error("Prazo inválido.");
  return date.toISOString();
}

export async function setCupConfirmation(formData: FormData) {
  await requireOrganizer();
  const supabase = await createClient();
  const cupId = requiredId(formData, "cupId", "a copa");
  const rawAmount = String(formData.get("amount") ?? "").trim().replace(",", ".");
  const rawDeadline = String(formData.get("deadline") ?? "").trim();

  let amount: number | null = null;
  if (rawAmount) {
    amount = Number(rawAmount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1000) throw new Error("Valor inválido. Deixe em branco para confirmação gratuita.");
    amount = Math.round(amount * 100) / 100;
  }
  const deadline = rawDeadline ? parseDeadline(rawDeadline) : null;

  const { error } = await supabase.from("cups").update({ confirm_amount: amount, confirm_deadline: deadline }).eq("id", cupId);
  if (error) throw new Error(error.message);
  revalidatePath(COPA_PATH);
  return deadline ? "Confirmação configurada." : "Confirmação fechada (sem prazo).";
}

export async function markCupPresencePaid(formData: FormData) {
  await requireOrganizer();
  const supabase = await createClient();
  const cupId = requiredId(formData, "cupId", "a copa");
  const profileId = requiredId(formData, "profileId", "o jogador");
  const { data: cup } = await supabase.from("cups").select("confirm_amount").eq("id", cupId).maybeSingle();
  const { error } = await supabase.from("cup_confirmations").upsert(
    {
      cup_id: cupId,
      profile_id: profileId,
      status: "confirmed",
      payment_source: "manual",
      amount: cup?.confirm_amount ?? null,
      decided_at: new Date().toISOString(),
    },
    { onConflict: "cup_id,profile_id" },
  );
  if (error) throw new Error(error.message);
  revalidatePath(COPA_PATH);
  return "Presença confirmada manualmente.";
}

export async function clearCupPresence(formData: FormData) {
  await requireOrganizer();
  const supabase = await createClient();
  const cupId = requiredId(formData, "cupId", "a copa");
  const profileId = requiredId(formData, "profileId", "o jogador");
  const { error } = await supabase.from("cup_confirmations").delete().eq("cup_id", cupId).eq("profile_id", profileId);
  if (error) throw new Error(error.message);
  revalidatePath(COPA_PATH);
  return "Confirmação removida.";
}

export async function markCupRefunded(formData: FormData) {
  await requireOrganizer();
  await markCupPaymentRefunded(requiredId(formData, "intentId", "a cobrança"));
  revalidatePath(COPA_PATH);
  return "Devolução registrada.";
}
