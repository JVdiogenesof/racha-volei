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

export async function promoteReserveToMember(formData: FormData) {
  const organizer = await requireOrganizer();
  const supabase = await createClient();
  const reserveEntryId = String(formData.get("reserveEntryId"));

  const { data: entry } = await supabase
    .from("reserve_list")
    .select("auth_user_id, full_name, phone")
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
  // mundo (vai precisar preencher a autoavaliação no próximo acesso, do
  // mesmo jeito que qualquer aprovado sem nota ainda).
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
