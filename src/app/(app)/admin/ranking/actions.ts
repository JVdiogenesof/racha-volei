"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrganizer } from "@/lib/auth";
import { getActiveCommunity } from "@/lib/community";
import { getProfileRankingSheet } from "@/lib/rankingAdjust";

const VALID_METRICS = ["attendance", "mvp", "wins"];

export async function adjustRanking(formData: FormData) {
  const organizer = await requireOrganizer();
  const supabase = await createClient();
  const community = await getActiveCommunity(organizer);
  const profileId = String(formData.get("profileId"));
  const metric = String(formData.get("metric"));
  const delta = Number(formData.get("delta"));

  if (!VALID_METRICS.includes(metric)) {
    throw new Error("Métrica inválida.");
  }
  if (!Number.isInteger(delta) || delta === 0) {
    throw new Error("Ajuste inválido.");
  }

  const { error } = await supabase.from("ranking_adjustments").insert({
    profile_id: profileId,
    metric,
    community,
    delta,
    created_by: organizer.id,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/admin/ranking");
  revalidatePath("/", "layout");
}

export async function deleteRankingAdjustment(formData: FormData) {
  await requireOrganizer();
  const supabase = await createClient();
  const id = String(formData.get("id"));

  const { error } = await supabase.from("ranking_adjustments").delete().eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/admin/ranking");
  revalidatePath("/", "layout");
}

function revalidateRanking(profileId?: string) {
  revalidatePath("/admin/ranking");
  if (profileId) revalidatePath(`/admin/ranking/${profileId}`);
  // Ranking em tempo real: atualiza todas as telas que mostram ranking.
  revalidatePath("/", "layout");
}

// Grava o ajuste de um racha como UMA linha por jogador/racha/métrica:
// o valor novo substitui o anterior, e delta 0 apaga o ajuste.
async function saveEventAdjustment(params: {
  profileId: string;
  eventId: string;
  metric: "attendance" | "mvp" | "wins" | "losses";
  delta: number;
  organizerId: string;
  community: "court" | "sand";
}) {
  const supabase = await createClient();
  const { error: deleteError } = await supabase
    .from("ranking_adjustments")
    .delete()
    .eq("profile_id", params.profileId)
    .eq("event_id", params.eventId)
    .eq("metric", params.metric)
    .eq("community", params.community);
  if (deleteError) throw new Error(deleteError.message);
  if (params.delta === 0) return;
  const { error } = await supabase.from("ranking_adjustments").insert({
    profile_id: params.profileId,
    event_id: params.eventId,
    metric: params.metric,
    community: params.community,
    delta: params.delta,
    reason: "Ajuste manual no racha",
    created_by: params.organizerId,
  });
  if (error) throw new Error(error.message);
}

// Vitórias e derrotas de um racha (+1 / -1): mudam o Índice VPA na hora.
export async function adjustEventResult(formData: FormData) {
  const organizer = await requireOrganizer();
  const supabase = await createClient();
  const community = await getActiveCommunity(organizer);
  const profileId = String(formData.get("profileId"));
  const eventId = String(formData.get("eventId"));
  const metric = String(formData.get("metric"));
  const step = Number(formData.get("delta"));
  if (metric !== "wins" && metric !== "losses") throw new Error("Métrica inválida.");
  if (step !== 1 && step !== -1) throw new Error("Ajuste inválido.");

  const sheet = await getProfileRankingSheet(supabase, community, profileId);
  const event = sheet.find((item) => item.id === eventId);
  if (!event) throw new Error("Racha não encontrado entre os últimos rachas encerrados.");
  const registered = metric === "wins" ? event.registered.wins : event.registered.losses;
  const nextAdjust = event.adjust[metric] + step;
  if (registered + nextAdjust < 0) throw new Error("O valor não pode ficar abaixo de zero.");

  await saveEventAdjustment({ profileId, eventId, metric, delta: nextAdjust, organizerId: organizer.id, community });
  revalidateRanking(profileId);
}

// Presença e Jogador Destaque de um racha (liga/desliga).
export async function setEventFlag(formData: FormData) {
  const organizer = await requireOrganizer();
  const supabase = await createClient();
  const community = await getActiveCommunity(organizer);
  const profileId = String(formData.get("profileId"));
  const eventId = String(formData.get("eventId"));
  const metric = String(formData.get("metric"));
  const desired = String(formData.get("value")) === "true";
  if (metric !== "attendance" && metric !== "mvp") throw new Error("Métrica inválida.");

  const sheet = await getProfileRankingSheet(supabase, community, profileId);
  const event = sheet.find((item) => item.id === eventId);
  if (!event) throw new Error("Racha não encontrado entre os últimos rachas encerrados.");
  const registered = metric === "attendance" ? event.registered.present : event.registered.mvp;
  const delta = desired === registered ? 0 : desired ? 1 : -1;

  await saveEventAdjustment({ profileId, eventId, metric, delta, organizerId: organizer.id, community });
  revalidateRanking(profileId);
}
