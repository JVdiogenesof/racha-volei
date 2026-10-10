"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireEventParticipant, requireOrganizer } from "@/lib/auth";
import { removeFromCurrentTeam } from "@/lib/teamCleanup";
import { sendPushToProfiles } from "@/lib/push";
import { isRegistrationOpen } from "@/lib/registrationSchedule";

export async function setAttendance(formData: FormData) {
  const eventId = String(formData.get("eventId"));
  const profile = await requireEventParticipant(eventId);
  const supabase = await createClient();
  const status = String(formData.get("status")) as "declined" | "interested";

  if (status !== "interested" && status !== "declined") {
    throw new Error("Só os organizadores podem confirmar presença de alguém na lista.");
  }

  const { data: event } = await supabase
    .from("events")
    .select("status, official_list_open, registration_opens_at")
    .eq("id", eventId)
    .maybeSingle();
  if (event?.status === "finished") {
    throw new Error("Esse racha já terminou, não dá mais pra responder.");
  }
  if (event?.status === "cancelled") {
    throw new Error("Esse racha foi cancelado, não dá mais pra responder.");
  }
  if (status === "interested" && (!event || !isRegistrationOpen(event.registration_opens_at, event.official_list_open))) {
    throw new Error("As inscrições desse racha ainda não abriram. Aguarde o fim da contagem regressiva.");
  }

  const { data: previous } = await supabase
    .from("attendance")
    .select("status, cancelled_at")
    .eq("event_id", eventId)
    .eq("profile_id", profile.id)
    .maybeSingle();

  // Só é "cancelamento" de verdade quem tava confirmado e saiu da lista --
  // marcar "não vou" sem nunca ter confirmado é resposta normal, não alarme.
  const wasConfirmedCancel = previous?.status === "confirmed" && status === "declined";
  const cancelledAt = wasConfirmedCancel
    ? new Date().toISOString()
    : status === "interested"
      ? null
      : (previous?.cancelled_at ?? null);

  const { error } = await supabase.from("attendance").upsert(
    {
      event_id: eventId,
      profile_id: profile.id,
      status,
      confirmed_at: new Date().toISOString(),
      cancelled_at: cancelledAt,
    },
    { onConflict: "event_id,profile_id" },
  );

  if (error) throw new Error(error.message);

  // Cancelou/só marcou interesse: se ela estava presa num time de uma geração
  // anterior, tira ela de lá também, sem precisar o organizador notar depois.
  await removeFromCurrentTeam(supabase, eventId, profile.id);

  revalidatePath(`/racha/${eventId}/confirmar`);
  revalidatePath(`/racha/${eventId}`);
  revalidatePath(`/racha/${eventId}/times`);
}

export async function promoteToConfirmed(formData: FormData) {
  await requireOrganizer();
  const supabase = await createClient();
  const eventId = String(formData.get("eventId"));
  const profileId = String(formData.get("profileId"));

  const { error } = await supabase.rpc("confirm_event_participant", {
    p_event_id: eventId,
    p_profile_id: profileId,
  });

  if (error) throw new Error(error.message);
  revalidatePath(`/racha/${eventId}/confirmar`);
  revalidatePath(`/racha/${eventId}`);
}

export async function demoteToInterested(formData: FormData) {
  await requireOrganizer();
  const supabase = await createClient();
  const eventId = String(formData.get("eventId"));
  const profileId = String(formData.get("profileId"));

  const { error } = await supabase
    .from("attendance")
    .update({ status: "interested" })
    .eq("event_id", eventId)
    .eq("profile_id", profileId);

  if (error) throw new Error(error.message);
  await removeFromCurrentTeam(supabase, eventId, profileId);

  revalidatePath(`/racha/${eventId}/confirmar`);
  revalidatePath(`/racha/${eventId}`);
  revalidatePath(`/racha/${eventId}/times`);
}

export async function setOfficialListOpen(formData: FormData) {
  const organizer = await requireOrganizer();
  const supabase = await createClient();
  const eventId = String(formData.get("eventId"));
  const open = String(formData.get("open")) === "true";

  const { data: changedEvent, error } = await supabase
    .from("events")
    .update({ official_list_open: open })
    .eq("id", eventId)
    .neq("official_list_open", open)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);

  if (open && changedEvent) {
    const [{ data: event }, { data: approvedProfiles }] = await Promise.all([
      supabase.from("events").select("date, community").eq("id", eventId).maybeSingle(),
      supabase.from("profiles").select("id, communities").eq("status", "approved").neq("id", organizer.id),
    ]);
    const dateLabel = event ? new Date(`${event.date}T00:00:00`).toLocaleDateString("pt-BR") : "";
    await sendPushToProfiles(
      supabase,
      (approvedProfiles ?? []).filter((p) => event && p.communities?.includes(event.community)).map((p) => p.id),
      { title: "Lista de confirmados publicada!", body: `Confira quem vai no racha de ${dateLabel}.`, url: `/racha/${eventId}/confirmar` },
    );
  }

  revalidatePath(`/racha/${eventId}/confirmar`);
  revalidatePath(`/racha/${eventId}`);
  revalidatePath("/racha");
  revalidatePath("/");
}

export async function setPaymentStatus(formData: FormData) {
  await requireOrganizer();
  const supabase = await createClient();
  const eventId = String(formData.get("eventId"));
  const profileId = String(formData.get("profileId"));
  const paidValue = String(formData.get("paid"));

  if (paidValue !== "true" && paidValue !== "false") {
    throw new Error("Situação de pagamento inválida.");
  }

  const paid = paidValue === "true";
  const { error } = await supabase.rpc("set_event_payment_status", {
    p_event_id: eventId,
    p_profile_id: profileId,
    p_paid: paid,
  });

  if (error) throw new Error(error.message);
  revalidatePath(`/racha/${eventId}/confirmar`);
  revalidatePath("/admin/financas");
}

export async function cancelPixAttendance(formData: FormData) {
  const eventId = String(formData.get("eventId"));
  const choice = String(formData.get("choice"));
  if (choice !== "balance" && choice !== "refund") throw new Error("Escolha de desistência inválida.");

  const profile = await requireEventParticipant(eventId);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cancel_event_pix_payment", {
    p_event_id: eventId,
    p_choice: choice,
  });
  if (error) throw new Error(error.message);

  await removeFromCurrentTeam(supabase, eventId, profile.id);
  const outcome = data?.[0]?.outcome;
  if (outcome === "balance") {
    revalidatePath("/admin/financas");
  }
  revalidatePath(`/racha/${eventId}/confirmar`);
  revalidatePath(`/racha/${eventId}`);
  revalidatePath(`/racha/${eventId}/times`);
}

export async function completePixRefund(formData: FormData) {
  await requireOrganizer();
  const intentId = String(formData.get("intentId"));
  const eventId = String(formData.get("eventId"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_event_pix_refund", { p_intent_id: intentId });
  if (error) throw new Error(error.message);
  revalidatePath(`/racha/${eventId}/confirmar`);
  revalidatePath("/admin/financas");
}

export async function setEventSetterRole(formData: FormData) {
  const organizer = await requireOrganizer();
  const supabase = await createClient();
  const eventId = String(formData.get("eventId"));
  const profileId = String(formData.get("profileId"));
  const setterValue = String(formData.get("isSetter"));

  if (setterValue !== "true" && setterValue !== "false") {
    throw new Error("Função de levantador inválida.");
  }

  const { data: attendanceRow, error: attendanceError } = await supabase
    .from("attendance")
    .select("status")
    .eq("event_id", eventId)
    .eq("profile_id", profileId)
    .maybeSingle();
  if (attendanceError) throw new Error(attendanceError.message);
  if (attendanceRow?.status !== "confirmed") {
    throw new Error("Só é possível ajustar levantadores que estão confirmados.");
  }

  const { error } = await supabase.from("event_setter_overrides").upsert(
    {
      event_id: eventId,
      profile_id: profileId,
      is_setter: setterValue === "true",
      changed_by: organizer.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "event_id,profile_id" },
  );
  if (error) throw new Error(error.message);

  revalidatePath(`/racha/${eventId}/confirmar`);
  revalidatePath(`/racha/${eventId}/times`);
}

export async function removeAttendance(formData: FormData) {
  await requireOrganizer();
  const supabase = await createClient();
  const eventId = String(formData.get("eventId"));
  const profileId = String(formData.get("profileId"));

  const { error } = await supabase
    .from("attendance")
    .delete()
    .eq("event_id", eventId)
    .eq("profile_id", profileId);

  if (error) throw new Error(error.message);
  await removeFromCurrentTeam(supabase, eventId, profileId);

  revalidatePath(`/racha/${eventId}/confirmar`);
  revalidatePath(`/racha/${eventId}`);
  revalidatePath(`/racha/${eventId}/times`);
}
