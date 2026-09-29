"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrganizer } from "@/lib/auth";

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

  const { error } = await supabase.rpc("invite_reserve_to_event", {
    p_reserve_entry_id: reserveEntryId,
    p_event_id: eventId,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/admin/reserva");
  revalidatePath(`/racha/${eventId}/confirmar`);
}

export async function promoteReserveToMember(formData: FormData) {
  await requireOrganizer();
  const supabase = await createClient();
  const reserveEntryId = String(formData.get("reserveEntryId"));

  const { error } = await supabase.rpc("promote_reserve_to_member", {
    p_reserve_entry_id: reserveEntryId,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/admin/reserva");
  revalidatePath("/jogadores");
  revalidatePath("/ranking");
}

export async function makeGuestPermanent(formData: FormData) {
  await requireOrganizer();
  const supabase = await createClient();
  const profileId = String(formData.get("profileId"));

  const { data: entry, error: lookupError } = await supabase
    .from("reserve_list")
    .select("id")
    .eq("auth_user_id", profileId)
    .maybeSingle();
  if (lookupError) throw new Error(lookupError.message);
  if (!entry) throw new Error("Pessoa não encontrada na lista de reserva.");
  const { error } = await supabase.rpc("promote_reserve_to_member", {
    p_reserve_entry_id: entry.id,
  });
  if (error) throw new Error(error.message);

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
