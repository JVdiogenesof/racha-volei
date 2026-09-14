"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrganizer } from "@/lib/auth";

export async function createReactionType(formData: FormData) {
  const organizer = await requireOrganizer();
  const supabase = await createClient();
  const text = String(formData.get("text") ?? "").trim();

  if (!text) throw new Error("Escreva o texto da reação.");
  if (!text.includes("{alvo}")) {
    throw new Error('O texto precisa ter "{alvo}" em algum lugar (é onde o nome da pessoa entra).');
  }

  const { error } = await supabase.from("reaction_types").insert({ text, created_by: organizer.id });
  if (error) throw new Error(error.message);

  revalidatePath("/admin/reacoes");
  revalidatePath("/reacoes");
}

export async function setReactionTypeActive(formData: FormData) {
  await requireOrganizer();
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const active = String(formData.get("active")) === "true";

  const { error } = await supabase.from("reaction_types").update({ active }).eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/reacoes");
  revalidatePath("/reacoes");
}

export async function deleteReactionType(formData: FormData) {
  await requireOrganizer();
  const supabase = await createClient();
  const id = String(formData.get("id"));

  const { error } = await supabase.from("reaction_types").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/reacoes");
  revalidatePath("/reacoes");
}
