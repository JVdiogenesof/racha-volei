"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { requireOrganizer } from "@/lib/auth";
import { SKILL_CATEGORIES } from "@/lib/scoring";

type ReserveRatings = {
  player_level: "beginner" | "intermediate" | "advanced" | null;
  self_attack: number | string | null;
  self_setting: number | string | null;
  self_serve: number | string | null;
  self_reception: number | string | null;
  self_defense: number | string | null;
  self_block: number | string | null;
};

/**
 * Copia a autoavaliação preenchida na inscrição da reserva pra self_ratings
 * quando a pessoa é chamada ou recebe acesso completo. O cadastro unificado
 * já cria o perfil visitante, mas mantém as notas na reserva até a liberação.
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
  const { error } = await supabase.from("self_ratings").upsert(rows, { onConflict: "profile_id,category" });
  if (error) throw new Error(error.message);
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
    .select("auth_user_id, full_name, phone, player_level, self_attack, self_setting, self_serve, self_reception, self_defense, self_block")
    .eq("id", reserveEntryId)
    .maybeSingle();
  if (!entry) throw new Error("Pessoa não encontrada na lista de reserva.");

  const { error } = await supabase.from("profiles").upsert(
    {
      id: entry.auth_user_id,
      full_name: entry.full_name,
      phone: entry.phone,
      player_level: entry.player_level,
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
    .select("auth_user_id, full_name, phone, player_level, self_attack, self_setting, self_serve, self_reception, self_defense, self_block")
    .eq("id", reserveEntryId)
    .maybeSingle();
  if (!entry) throw new Error("Pessoa não encontrada na lista de reserva.");

  // Garante compatibilidade com inscrições antigas que ainda não tinham perfil.
  const { error: insertError } = await supabase.from("profiles").upsert(
    {
      id: entry.auth_user_id,
      full_name: entry.full_name,
      phone: entry.phone,
      player_level: entry.player_level,
      status: "visitor",
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
    .in("status", ["visitor", "guest"]);
  if (promoteError) throw new Error(promoteError.message);
  await copyReserveRatingsToProfile(supabase, entry.auth_user_id, entry);

  await supabase.from("reserve_list").delete().eq("id", reserveEntryId);

  revalidatePath("/admin/reserva");
  revalidatePath("/jogadores");
  revalidatePath("/ranking");
}

export async function makeGuestPermanent(formData: FormData) {
  const organizer = await requireOrganizer();
  const supabase = await createClient();
  const profileId = String(formData.get("profileId"));

  // Sai do modo de convite específico e recebe acesso completo ao app.
  const { error } = await supabase
    .from("profiles")
    .update({ status: "approved", guest_for_event_id: null, approved_by: organizer.id })
    .eq("id", profileId)
    .eq("status", "guest");
  if (error) throw new Error(error.message);

  // Não é mais "gente de fora disponível pra chamar" — já é do grupo.
  await supabase.from("reserve_list").delete().eq("auth_user_id", profileId);

  revalidatePath("/admin/reserva");
  revalidatePath("/jogadores");
  revalidatePath("/ranking");
}

export async function endGuestAccess(formData: FormData) {
  await requireOrganizer();
  const supabase = await createClient();
  const profileId = String(formData.get("profileId"));

  const { error } = await supabase
    .from("profiles")
    .update({ status: "visitor", guest_for_event_id: null, approved_by: null })
    .eq("id", profileId)
    .eq("status", "guest");
  if (error) throw new Error(error.message);
  revalidatePath("/admin/reserva");
}
