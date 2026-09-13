"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrganizer } from "@/lib/auth";
import { sendPushToProfiles } from "@/lib/push";

export async function setMvp(formData: FormData) {
  const organizer = await requireOrganizer();
  const supabase = await createClient();
  const eventId = String(formData.get("eventId"));
  const profileId = String(formData.get("profileId"));

  const { data: event } = await supabase.from("events").select("status, date").eq("id", eventId).maybeSingle();
  if (event?.status !== "finished") {
    throw new Error("Só dá pra escolher o Jogador Destaque depois que o racha for finalizado.");
  }

  const { data: attendanceRows } = await supabase
    .from("attendance")
    .select("profile_id, status")
    .eq("event_id", eventId);
  const myAttendance = attendanceRows?.find((a) => a.profile_id === profileId);
  if (myAttendance?.status !== "confirmed") {
    throw new Error("O Jogador Destaque precisa ser alguém confirmado nesse racha.");
  }

  const { error } = await supabase.from("events").update({ mvp_profile_id: profileId }).eq("id", eventId);
  if (error) throw new Error(error.message);

  const { data: destaqueProfile } = await supabase.from("profiles").select("full_name").eq("id", profileId).maybeSingle();
  const dateLabel = new Date(`${event.date}T00:00:00`).toLocaleDateString("pt-BR");
  const confirmedIds = attendanceRows?.filter((a) => a.status === "confirmed").map((a) => a.profile_id) ?? [];
  await sendPushToProfiles(
    supabase,
    confirmedIds.filter((id) => id !== organizer.id),
    {
      title: "Jogador Destaque escolhido! 🏆",
      body: `${destaqueProfile?.full_name ?? "Alguém"} foi eleito Jogador Destaque do racha de ${dateLabel}!`,
      url: `/racha/${eventId}/mvp`,
    },
  );

  revalidatePath(`/racha/${eventId}/mvp`);
  revalidatePath("/ranking");
}

export async function clearMvp(formData: FormData) {
  await requireOrganizer();
  const supabase = await createClient();
  const eventId = String(formData.get("eventId"));

  const { error } = await supabase.from("events").update({ mvp_profile_id: null }).eq("id", eventId);
  if (error) throw new Error(error.message);
  revalidatePath(`/racha/${eventId}/mvp`);
  revalidatePath("/ranking");
}
