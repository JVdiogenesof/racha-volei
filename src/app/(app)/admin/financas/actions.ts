"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrganizer } from "@/lib/auth";
import { getActiveCommunity } from "@/lib/community";

const BALANCE_CATEGORIES = new Set(["advance_payment", "cancellation_credit", "challenge", "other"]);
const CASH_EFFECTS = new Set(["none", "income", "expense"]);
const TRANSACTION_TYPES = new Set(["income", "expense"]);
const TRANSACTION_CATEGORIES = new Set(["sponsorship", "court_rental", "medals", "other"]);

function requiredText(formData: FormData, key: string, label: string, maxLength: number) {
  const value = String(formData.get(key) ?? "").trim();
  if (!value) throw new Error(`${label} é obrigatório.`);
  if (value.length > maxLength) throw new Error(`${label} deve ter no máximo ${maxLength} caracteres.`);
  return value;
}

function optionalText(formData: FormData, key: string, maxLength: number) {
  const value = String(formData.get(key) ?? "").trim();
  if (value.length > maxLength) throw new Error(`O texto deve ter no máximo ${maxLength} caracteres.`);
  return value || null;
}

function positiveAmount(formData: FormData) {
  const amount = Number(String(formData.get("amount") ?? "").replace(",", "."));
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100000) throw new Error("Informe um valor válido maior que zero.");
  return Math.round(amount * 100) / 100;
}

function revalidateFinance(eventId?: string) {
  revalidatePath("/admin/financas");
  if (eventId) revalidatePath(`/racha/${eventId}/confirmar`);
}

export async function addPlayerBalance(formData: FormData) {
  const organizer = await requireOrganizer();
  const community = await getActiveCommunity(organizer);
  const profileId = requiredText(formData, "profileId", "Pessoa", 50);
  const amount = positiveAmount(formData);
  const category = requiredText(formData, "category", "Motivo", 40);
  const cashEffect = requiredText(formData, "cashEffect", "Movimento no caixa", 20);
  const description = requiredText(formData, "description", "Descrição", 120);
  const notes = optionalText(formData, "notes", 500);
  if (!BALANCE_CATEGORIES.has(category)) throw new Error("Motivo do saldo inválido.");
  if (!CASH_EFFECTS.has(cashEffect)) throw new Error("Movimento no caixa inválido.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("add_player_balance", {
    p_profile_id: profileId, p_community: community, p_amount: amount,
    p_category: category, p_description: description, p_notes: notes ?? "", p_cash_effect: cashEffect,
  });
  if (error) throw new Error(error.message);
  revalidateFinance();
}

export async function applyPlayerBalance(formData: FormData) {
  await requireOrganizer();
  const profileId = requiredText(formData, "profileId", "Pessoa", 50);
  const eventId = requiredText(formData, "eventId", "Racha", 50);
  const supabase = await createClient();
  const { error } = await supabase.rpc("apply_player_balance", { p_event_id: eventId, p_profile_id: profileId });
  if (error) throw new Error(error.message);
  revalidateFinance(eventId);
}

export async function reversePlayerBalance(formData: FormData) {
  await requireOrganizer();
  const entryId = requiredText(formData, "entryId", "Lançamento", 50);
  const supabase = await createClient();
  const { error } = await supabase.rpc("reverse_player_balance_entry", { p_entry_id: entryId });
  if (error) throw new Error(error.message);
  revalidateFinance();
}

export async function addFinanceTransaction(formData: FormData) {
  const organizer = await requireOrganizer();
  const community = await getActiveCommunity(organizer);
  const transactionType = requiredText(formData, "transactionType", "Tipo", 20);
  const category = requiredText(formData, "category", "Categoria", 30);
  const description = requiredText(formData, "description", "Descrição", 160);
  const amount = positiveAmount(formData);
  const transactionDate = requiredText(formData, "transactionDate", "Data", 10);
  const notes = optionalText(formData, "notes", 500);
  if (!TRANSACTION_TYPES.has(transactionType)) throw new Error("Tipo de movimentação inválido.");
  if (!TRANSACTION_CATEGORIES.has(category)) throw new Error("Categoria inválida.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(transactionDate)) throw new Error("Data inválida.");

  const supabase = await createClient();
  const { error } = await supabase.from("finance_transactions").insert({
    community, transaction_type: transactionType, category, description, amount,
    transaction_date: transactionDate, notes, created_by: organizer.id,
  });
  if (error) throw new Error(error.message);
  revalidateFinance();
}

export async function voidFinanceTransaction(formData: FormData) {
  const organizer = await requireOrganizer();
  const community = await getActiveCommunity(organizer);
  const transactionId = requiredText(formData, "transactionId", "Movimentação", 50);
  const supabase = await createClient();
  const { data, error } = await supabase.from("finance_transactions")
    .update({ voided_at: new Date().toISOString(), voided_by: organizer.id })
    .eq("id", transactionId).eq("community", community).is("payment_id", null)
    .is("balance_entry_id", null).is("voided_at", null).select("id").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Lançamentos automáticos devem ser corrigidos no pagamento ou no saldo da pessoa.");
  revalidateFinance();
}

export async function addFinanceReminder(formData: FormData) {
  const organizer = await requireOrganizer();
  const community = await getActiveCommunity(organizer);
  const title = requiredText(formData, "title", "Lembrete", 140);
  const notes = optionalText(formData, "notes", 500);
  const dueDate = String(formData.get("dueDate") ?? "").trim() || null;
  if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) throw new Error("Data do lembrete inválida.");
  const supabase = await createClient();
  const { error } = await supabase.from("finance_reminders").insert({ community, title, notes, due_date: dueDate, created_by: organizer.id });
  if (error) throw new Error(error.message);
  revalidateFinance();
}

export async function toggleFinanceReminder(formData: FormData) {
  const organizer = await requireOrganizer();
  const community = await getActiveCommunity(organizer);
  const reminderId = requiredText(formData, "reminderId", "Lembrete", 50);
  const completed = String(formData.get("completed")) === "true";
  const supabase = await createClient();
  const { error } = await supabase.from("finance_reminders").update({
    completed, completed_at: completed ? new Date().toISOString() : null,
    completed_by: completed ? organizer.id : null,
  }).eq("id", reminderId).eq("community", community);
  if (error) throw new Error(error.message);
  revalidateFinance();
}
