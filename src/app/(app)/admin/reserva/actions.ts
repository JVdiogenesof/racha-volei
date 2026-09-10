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

  const { data: entry } = await supabase
    .from("reserve_list")
    .select("auth_user_id, full_name, phone")
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

  revalidatePath("/admin/reserva");
}

export async function endGuestAccess(formData: FormData) {
  await requireOrganizer();
  const supabase = await createClient();
  const profileId = String(formData.get("profileId"));

  const { error } = await supabase.from("profiles").delete().eq("id", profileId).eq("status", "guest");
  if (error) throw new Error(error.message);
  revalidatePath("/admin/reserva");
}
