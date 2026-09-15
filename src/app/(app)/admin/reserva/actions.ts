"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { requireOrganizer } from "@/lib/auth";
import { SKILL_CATEGORIES } from "@/lib/scoring";

type ReserveRatings = {
  self_attack: number | string | null;
  self_setting: number | string | null;
  self_serve: number | string | null;
  self_reception: number | string | null;
  self_defense: number | string | null;
  self_block: number | string | null;
};

/**
 * Copia a autoavaliação preenchida na inscrição da reserva pra self_ratings
 * assim que a pessoa ganha uma linha de verdade em profiles (convidada pra
 * um racha ou promovida a permanente) -- antes disso não tinha profile_id
 * pra guardar em self_ratings.
 */
async function copyReserveRatingsToProfile(supabase: SupabaseClient, profileId: string, entry: ReserveRatings) {
  const columnByCategory: Record<(typeof SKILL_CATEGORIES)[number], number | string | null> = {
    attack: entry.self_attack,
    setting: entry.self_setting,
    serve: entry.self_serve,
    reception: entry.self_reception,
    defense: entry.self_defense,
    block: entry.self_block,
  };
  const rows = SKILL_CATEGORIES.map((category) => ({
    profile_id: profileId,
    category,
    value: Number(columnByCategory[category] ?? 2.5),
  }));
  await supabase.from("self_ratings").upsert(rows, { onConflict: "profile_id,category" });
}

export async function toggleContacted(formData: FormData) {
  await requireOrganizer();
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const contacted = String(formData.get("contacted")) === "true";

  const { error } = await supabase.from("reserve_list").update({ contacted }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/reserva");
}

export async function removeFromReserveList(formData: FormData) {
  await requireOrganizer();
  const supabase = await createClient();
  const id = String(formData.get("id"));

  const { error } = await supabase.from("reserve_list").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/reserva");
}

export async function inviteToEvent(formData: FormData) {
  await requireOrganizer();
  const supabase = await createClient();
  const reserveEntryId = String(formData.get("reserveEntryId"));
  const eventId = String(formData.get("eventId") ?? "");

  if (!eventId) {
    throw new Error("Escolha um racha pra chamar essa pessoa.");
  }

  const { data: entry } = await supabase
    .from("reserve_list")
    .select("auth_user_id, full_name, phone, self_attack, self_setting, self_serve, self_reception, self_defense, self_block")
    .eq("id", reserveEntryId)
    .maybeSingle();
  if (!entry) throw new Error("Pessoa não encontrada na lista de reserva.");

  const { error } = await supabase.from("profiles").upsert(
    {
      id: entry.auth_user_id,
      full_name: entry.full_name,
      phone: entry.phone,
      status: "guest",
      is_organizer: false,
      guest_for_event_id: eventId,
    },
    { onConflict: "id" },
  );
  if (error) throw new Error(error.message);
  await copyReserveRatingsToProfile(supabase, entry.auth_user_id, entry);

  revalidatePath("/admin/reserva");
  revalidatePath(`/racha/${eventId}/confirmar`);
}

export async function promoteReserveToMember(formData: FormData) {
  const organizer = await requireOrganizer();
  const supabase = await createClient();
  const reserveEntryId = String(formData.get("reserveEntryId"));

  const { data: entry } = await supabase
    .from("reserve_list")
    .select("auth_user_id, full_name, phone, self_attack, self_setting, self_serve, self_reception, self_defense, self_block")
    .eq("id", reserveEntryId)
    .maybeSingle();
  if (!entry) throw new Error("Pessoa não encontrada na lista de reserva.");

  // Não existe (de propósito) uma permissão pra organizador inserir um
  // perfil já como "approved" direto — só como "guest" (acesso de um racha
  // só). Por isso insere como guest primeiro e promove na sequência; as duas
  // operações já são permitidas separadamente.
  const { error: insertError } = await supabase.from("profiles").upsert(
    {
      id: entry.auth_user_id,
      full_name: entry.full_name,
      phone: entry.phone,
      status: "guest",
      is_organizer: false,
      guest_for_event_id: null,
    },
    { onConflict: "id" },
  );
  if (insertError) throw new Error(insertError.message);

  const { error: promoteError } = await supabase
    .from("profiles")
    .update({ status: "approved", guest_for_event_id: null, approved_by: organizer.id })
    .eq("id", entry.auth_user_id)
    .eq("status", "guest");
  if (promoteError) throw new Error(promoteError.message);
  await copyReserveRatingsToProfile(supabase, entry.auth_user_id, entry);

  await supabase.from("reserve_list").delete().eq("id", reserveEntryId);

  revalidatePath("/admin/reserva");
  revalidatePath("/admin/solicitacoes");
  revalidatePath("/jogadores");
  revalidatePath("/ranking");
}

export async function makeGuestPermanent(formData: FormData) {
  const organizer = await requireOrganizer();
  const supabase = await createClient();
  const profileId = String(formData.get("profileId"));

  // Vira membro de verdade: sai do modo "só esse racha" e entra igual todo
  // mundo. A autoavaliação já veio da inscrição na reserva (copiada em
  // inviteToEvent) -- só falta completar aniversário/telefone/posição, que o
  // middleware já resolve mandando pra /cadastro sozinho.
  const { error } = await supabase
    .from("profiles")
    .update({ status: "approved", guest_for_event_id: null, approved_by: organizer.id })
    .eq("id", profileId)
    .eq("status", "guest");
  if (error) throw new Error(error.message);

  // Não é mais "gente de fora disponível pra chamar" — já é do grupo.
  await supabase.from("reserve_list").delete().eq("auth_user_id", profileId);

  revalidatePath("/admin/reserva");
  revalidatePath("/admin/solicitacoes");
  revalidatePath("/jogadores");
  revalidatePath("/ranking");
}

export async function endGuestAccess(formData: FormData) {
  await requireOrganizer();
  const supabase = await createClient();
  const profileId = String(formData.get("profileId"));

  const { error } = await supabase.from("profiles").delete().eq("id", profileId).eq("status", "guest");
  if (error) throw new Error(error.message);
  revalidatePath("/admin/reserva");
}
