"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrganizer } from "@/lib/auth";
import { sendPushToProfiles } from "@/lib/push";
import { getActiveCommunity } from "@/lib/community";
import type { EventGameStyle } from "@/lib/eventGameStyle";
import { registrationOpensAtFromForm } from "@/lib/registrationSchedule";

function parseRegistrationSchedule(formData: FormData, eventDate: string, eventTime: string | null) {
  const registrationOpensAt = registrationOpensAtFromForm(
    String(formData.get("registrationOpenDate") ?? ""),
    String(formData.get("registrationOpenTime") ?? ""),
  );
  const eventStartsAt = new Date(`${eventDate}T${eventTime ?? "23:59"}:00-03:00`);
  if (new Date(registrationOpensAt).getTime() >= eventStartsAt.getTime()) {
    throw new Error("As inscrições precisam abrir antes do início do racha.");
  }
  return registrationOpensAt;
}

function parseEventCapacity(formData: FormData) {
  const numTeams = Number(formData.get("numTeams") ?? 2);
  const teamSize = Number(formData.get("teamSize") ?? 6);
  const maxPlayers = Number(formData.get("maxPlayers") ?? 0);
  const newcomerReservedSpots = Number(formData.get("newcomerReservedSpots") ?? 0);
  const teamCapacity = numTeams * teamSize;
  const gameStyle = String(formData.get("gameStyle") ?? "casual") as EventGameStyle;

  if (!Number.isInteger(numTeams) || numTeams < 2) throw new Error("Informe pelo menos 2 times.");
  if (![3, 4, 6].includes(teamSize)) throw new Error("Escolha Trio, Quarteto ou Sexteto.");
  if (!["casual", "mini_tournament", "pre_tournament"].includes(gameStyle)) {
    throw new Error("Escolha um estilo de jogo válido.");
  }
  if (gameStyle !== "casual" && numTeams < 4) {
    throw new Error("Mini torneio e pré-torneio precisam de pelo menos 4 times.");
  }
  if (!Number.isInteger(maxPlayers) || maxPlayers < 1 || maxPlayers > teamCapacity) {
    throw new Error(`As vagas precisam ficar entre 1 e ${teamCapacity} para esse formato.`);
  }
  if (
    !Number.isInteger(newcomerReservedSpots) ||
    newcomerReservedSpots < 0 ||
    newcomerReservedSpots > maxPlayers
  ) {
    throw new Error("A quantidade de vagas para novatos não pode ultrapassar o total de vagas.");
  }

  return { numTeams, teamSize, maxPlayers, newcomerReservedSpots, gameStyle };
}

export async function createEvent(formData: FormData) {
  const organizer = await requireOrganizer();
  const supabase = await createClient();
  const community = await getActiveCommunity(organizer);

  const date = String(formData.get("date") ?? "");
  const time = String(formData.get("time") ?? "") || null;
  const location = String(formData.get("location") ?? "").trim() || null;
  const registrationOpensAt = parseRegistrationSchedule(formData, date, time);
  const { numTeams, teamSize, maxPlayers, newcomerReservedSpots, gameStyle } = parseEventCapacity(formData);
  const pricePerPlayerRaw = String(formData.get("pricePerPlayer") ?? "").trim();
  const pricePerPlayer = pricePerPlayerRaw ? Number(pricePerPlayerRaw) : null;
  const pixPaymentEnabled = String(formData.get("pixPaymentEnabled")) === "true";
  const isPreTorneio = gameStyle === "pre_tournament";
  const isMiniTorneio = gameStyle === "mini_tournament";

  if (!date || numTeams < 1) {
    throw new Error("Data e número de times são obrigatórios.");
  }

  const { data, error } = await supabase
    .from("events")
    .insert({
      date,
      time,
      location,
      num_teams: numTeams,
      team_size: teamSize,
      price_per_player: pricePerPlayer,
      pix_payment_enabled: pixPaymentEnabled,
      max_players: maxPlayers,
      newcomer_reserved_spots: newcomerReservedSpots,
      community,
      is_pre_torneio: isPreTorneio,
      is_mini_torneio: isMiniTorneio,
      registration_opens_at: registrationOpensAt,
      created_by: organizer.id,
      official_list_open: false,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  const { data: approvedProfiles } = await supabase
    .from("profiles")
    .select("id")
    .eq("status", "approved")
    .contains("communities", [community])
    .neq("id", organizer.id);
  const dateLabel = new Date(`${date}T00:00:00`).toLocaleDateString("pt-BR");
  await sendPushToProfiles(
    supabase,
    (approvedProfiles ?? []).map((p) => p.id),
    { title: `Novo racha de ${community === "sand" ? "areia" : "quadra"}!`, body: `Racha de ${dateLabel}. Diga se você vai.`, url: `/racha/${data.id}` },
  );

  revalidatePath("/admin/rachas");
  revalidatePath("/racha");
  revalidatePath("/");
  redirect(`/racha/${data.id}?criado=1`);
}

export async function updateEvent(formData: FormData) {
  await requireOrganizer();
  const supabase = await createClient();

  const eventId = String(formData.get("eventId"));
  const date = String(formData.get("date") ?? "");
  const time = String(formData.get("time") ?? "") || null;
  const location = String(formData.get("location") ?? "").trim() || null;
  const registrationOpensAt = parseRegistrationSchedule(formData, date, time);
  const { numTeams, teamSize, maxPlayers, newcomerReservedSpots, gameStyle } = parseEventCapacity(formData);
  const pricePerPlayerRaw = String(formData.get("pricePerPlayer") ?? "").trim();
  const pricePerPlayer = pricePerPlayerRaw ? Number(pricePerPlayerRaw) : null;
  const pixPaymentEnabled = String(formData.get("pixPaymentEnabled")) === "true";
  const isPreTorneio = gameStyle === "pre_tournament";
  const isMiniTorneio = gameStyle === "mini_tournament";

  if (!date || numTeams < 1) {
    throw new Error("Data e número de times são obrigatórios.");
  }

  const { data: confirmedRows, error: confirmedError } = await supabase
    .from("attendance")
    .select("profile_id, uses_newcomer_spot")
    .eq("event_id", eventId)
    .eq("status", "confirmed");
  if (confirmedError) throw new Error(confirmedError.message);

  const confirmed = confirmedRows ?? [];
  const newcomerCount = confirmed.filter((row) => row.uses_newcomer_spot).length;
  const regularCount = confirmed.length - newcomerCount;
  if (confirmed.length > maxPlayers) {
    throw new Error(`Já existem ${confirmed.length} confirmados. Aumente o total de vagas antes de salvar.`);
  }
  if (regularCount > maxPlayers - newcomerReservedSpots) {
    throw new Error(
      `Já existem ${regularCount} membros confirmados. Reduza as vagas de novatos ou aumente o total de vagas.`,
    );
  }

  const { error } = await supabase
    .from("events")
    .update({
      date,
      time,
      location,
      num_teams: numTeams,
      team_size: teamSize,
      price_per_player: pricePerPlayer,
      pix_payment_enabled: pixPaymentEnabled,
      max_players: maxPlayers,
      newcomer_reserved_spots: newcomerReservedSpots,
      is_pre_torneio: isPreTorneio,
      is_mini_torneio: isMiniTorneio,
      registration_opens_at: registrationOpensAt,
    })
    .eq("id", eventId);

  if (error) throw new Error(error.message);
  revalidatePath("/admin/rachas");
  revalidatePath("/racha");
  revalidatePath(`/racha/${eventId}`);
  revalidatePath("/");
}

export async function markAsPreTorneio(formData: FormData) {
  await requireOrganizer();
  const supabase = await createClient();
  const eventId = String(formData.get("eventId"));

  // Só liga a flag -- número de times e vagas ficam do jeito que o
  // organizador já configurou, ajustáveis à parte pelo formulário de edição.
  const { error } = await supabase
    .from("events")
    .update({ is_pre_torneio: true, is_mini_torneio: false })
    .eq("id", eventId);

  if (error) throw new Error(error.message);
  revalidatePath("/admin/rachas");
  revalidatePath("/racha");
  revalidatePath(`/racha/${eventId}`);
  revalidatePath("/");
}

export async function cancelEvent(formData: FormData) {
  await requireOrganizer();
  const supabase = await createClient();
  const eventId = String(formData.get("eventId"));

  const { error } = await supabase.from("events").update({ status: "cancelled" }).eq("id", eventId);

  if (error) throw new Error(error.message);
  revalidatePath("/admin/rachas");
  revalidatePath("/racha");
  revalidatePath(`/racha/${eventId}`);
  revalidatePath("/");
}

export async function deleteEvent(formData: FormData) {
  await requireOrganizer();
  const supabase = await createClient();
  const eventId = String(formData.get("eventId"));

  const { error } = await supabase.from("events").delete().eq("id", eventId);

  if (error) throw new Error(error.message);
  revalidatePath("/admin/rachas");
  revalidatePath("/racha");
  revalidatePath("/");
}
