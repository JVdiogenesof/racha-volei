"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";

export async function voteMvp(formData: FormData) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const eventId = String(formData.get("eventId"));
  const votedForProfileId = String(formData.get("votedForProfileId"));

  if (votedForProfileId === profile.id) {
    throw new Error("Você não pode votar em si mesmo.");
  }

  const { data: event } = await supabase.from("events").select("status").eq("id", eventId).maybeSingle();
  if (event?.status !== "finished") {
    throw new Error("A votação de MVP só abre depois que o racha for finalizado.");
  }

  const [{ count: confirmedCount }, { count: votesCount }] = await Promise.all([
    supabase
      .from("attendance")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId)
      .eq("status", "confirmed"),
    supabase.from("mvp_votes").select("id", { count: "exact", head: true }).eq("event_id", eventId),
  ]);

  if ((confirmedCount ?? 0) > 0 && (votesCount ?? 0) > (confirmedCount ?? 0) / 2) {
    throw new Error("A votação já foi encerrada — a maioria já votou.");
  }

  const { error } = await supabase.from("mvp_votes").insert({
    event_id: eventId,
    voter_profile_id: profile.id,
    voted_for_profile_id: votedForProfileId,
  });

  if (error) throw new Error(error.message);
  revalidatePath(`/racha/${eventId}/mvp`);
}
