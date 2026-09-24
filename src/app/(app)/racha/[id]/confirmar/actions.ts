"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, requireOrganizer } from "@/lib/auth";
import { removeFromCurrentTeam } from "@/lib/teamCleanup";
import { sendPushToProfiles } from "@/lib/push";

export async function setAttendance(formData: FormData) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const eventId = String(formData.get("eventId"));
  const status = String(formData.get("status")) as "declined" | "interested";

  if (status !== "interested" && status !== "declined") {
    throw new Error("Só os organizadores podem confirmar presença de alguém na lista.");
  }

  const { data: event } = await supabase.from("events").select("status").eq("id", eventId).maybeSingle();
  if (event?.status === "finished") {
    throw new Error("Esse racha já terminou, não dá mais pra responder.");
  }
  if (event?.status === "cancelled") {
    throw new Error("Esse racha foi cancelado, não dá mais pra responder.");
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

  const { error } = await supabase.from("attendance").upsert(
    {
      event_id: eventId,
      profile_id: profileId,
      status: "confirmed",
      confirmed_at: new Date().toISOString(),
      cancelled_at: null,
    },
    { onConflict: "event_id,profile_id" },
  );

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

  const { error } = await supabase.from("events").update({ official_list_open: open }).eq("id", eventId);
  if (error) throw new Error(error.message);

  if (open) {
    const [{ data: event }, { data: approvedProfiles }] = await Promise.all([
      supabase.from("events").select("date").eq("id", eventId).maybeSingle(),
      supabase.from("profiles").select("id").eq("status", "approved").neq("id", organizer.id),
    ]);
    const dateLabel = event ? new Date(`${event.date}T00:00:00`).toLocaleDateString("pt-BR") : "";
    await sendPushToProfiles(
      supabase,
      (approvedProfiles ?? []).map((p) => p.id),
      { title: "Lista de confirmados publicada!", body: `Confira quem vai no racha de ${dateLabel}.`, url: `/racha/${eventId}/confirmar` },
    );
  }

  revalidatePath(`/racha/${eventId}/confirmar`);
  revalidatePath(`/racha/${eventId}`);
  revalidatePath("/racha");
  revalidatePath("/");
}

export async function setPaymentStatus(formData: FormData) {
  const organizer = await requireOrganizer();
  const supabase = await createClient();
  const eventId = String(formData.get("eventId"));
  const profileId = String(formData.get("profileId"));
  const paidValue = String(formData.get("paid"));

  if (paidValue !== "true" && paidValue !== "false") {
    throw new Error("Situação de pagamento inválida.");
  }

  const paid = paidValue === "true";
  const { error } = await supabase.from("payments").upsert(
    {
      event_id: eventId,
      profile_id: profileId,
      paid,
      paid_at: paid ? new Date().toISOString() : null,
      marked_by: paid ? organizer.id : null,
    },
    { onConflict: "event_id,profile_id" },
  );

  if (error) throw new Error(error.message);
  revalidatePath(`/racha/${eventId}/confirmar`);
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
