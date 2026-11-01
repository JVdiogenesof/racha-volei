"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrganizer } from "@/lib/auth";
import { getActiveCommunity } from "@/lib/community";
import {
  COPA_PATH,
  clearCupQualificationsFromEvent,
  getCupRankingQueue,
  linkEventToCup,
  lockCupPlayersIntoFinal,
  releaseCupPlayerFromFinal,
  reprocessCupQualifier,
  syncCupFinalList,
  type Cup,
} from "@/lib/copaVpa";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function requiredId(formData: FormData, key: string, label: string) {
  const value = String(formData.get(key) ?? "").trim();
  if (!value) throw new Error(`Escolha ${label}.`);
  return value;
}

/** Data da final é opcional: em branco = "a definir". */
function parseOptionalFinalDate(formData: FormData) {
  const value = String(formData.get("finalDate") ?? "").trim();
  if (!value) return null;
  if (!DATE_PATTERN.test(value)) throw new Error("Data da final inválida.");
  return value;
}

function revalidateCup(eventIds: (string | null | undefined)[] = []) {
  revalidatePath(COPA_PATH);
  revalidatePath("/");
  for (const eventId of eventIds) {
    if (!eventId) continue;
    revalidatePath(`/racha/${eventId}`);
    revalidatePath(`/racha/${eventId}/confirmar`);
  }
}

async function loadCup(supabase: Awaited<ReturnType<typeof createClient>>, cupId: string) {
  const { data, error } = await supabase
    .from("cups")
    .select("id, community, name, final_date, qualifier_dates, num_teams, team_size, final_event_id")
    .eq("id", cupId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Copa não encontrada.");
  return data as Cup;
}

async function requireEventInCommunity(supabase: Awaited<ReturnType<typeof createClient>>, eventId: string, cup: Cup) {
  const { data: event, error } = await supabase.from("events").select("id, community, status, date").eq("id", eventId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!event || event.community !== cup.community) throw new Error("Racha não encontrado nesta modalidade.");
  return event;
}

export async function createCup(formData: FormData) {
  const organizer = await requireOrganizer();
  const supabase = await createClient();
  const community = await getActiveCommunity(organizer);

  const name = String(formData.get("name") ?? "").trim() || "Copa VPA";
  const finalDate = parseOptionalFinalDate(formData);
  const numTeams = Number(formData.get("numTeams") ?? 4);
  const teamSize = Number(formData.get("teamSize") ?? 6);
  const qualifierDates = String(formData.get("qualifierDates") ?? "")
    .split(/[\s,;]+/)
    .map((value) => value.trim())
    .filter(Boolean);

  if (name.length > 80) throw new Error("O nome deve ter no máximo 80 caracteres.");
  if (!Number.isInteger(numTeams) || numTeams < 2 || numTeams > 8) throw new Error("Informe entre 2 e 8 times.");
  if (!Number.isInteger(teamSize) || teamSize < 2 || teamSize > 12) throw new Error("Informe entre 2 e 12 jogadores por time.");
  const year = (finalDate ?? new Date().toISOString()).slice(0, 4);
  const parsedDates = qualifierDates.map((value) => {
    const match = value.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/);
    const iso = match ? `${match[3] ?? year}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}` : value;
    if (!DATE_PATTERN.test(iso)) throw new Error(`Data de classificatória inválida: ${value}`);
    if (finalDate && iso >= finalDate) throw new Error("As classificatórias precisam acontecer antes da final.");
    return iso;
  });

  const { error } = await supabase.from("cups").insert({
    community,
    name,
    final_date: finalDate,
    qualifier_dates: [...new Set(parsedDates)].sort(),
    num_teams: numTeams,
    team_size: teamSize,
    created_by: organizer.id,
  });
  if (error) throw new Error(error.message);

  // Rachas que já existem nas datas escolhidas entram na hora.
  const { data: events } = await supabase
    .from("events")
    .select("id, date")
    .eq("community", community)
    .neq("status", "cancelled")
    .in("date", finalDate ? [...parsedDates, finalDate] : parsedDates);
  for (const event of events ?? []) {
    await linkEventToCup(supabase, { id: event.id, date: event.date, community });
    if (event.date !== finalDate) await reprocessCupQualifier(supabase, event.id, organizer.id);
  }

  revalidateCup();
  return `${name} criada!`;
}

export async function addCupQualifier(formData: FormData) {
  const organizer = await requireOrganizer();
  const supabase = await createClient();
  const cup = await loadCup(supabase, requiredId(formData, "cupId", "a copa"));
  const eventId = requiredId(formData, "eventId", "o racha");
  await requireEventInCommunity(supabase, eventId, cup);
  if (eventId === cup.final_event_id) throw new Error("Esse racha já é a final da copa.");

  const { error } = await supabase.from("cup_qualifiers").insert({ cup_id: cup.id, event_id: eventId });
  if (error) {
    if (error.code === "23505") throw new Error("Esse racha já é classificatório de uma copa.");
    throw new Error(error.message);
  }
  const processed = await reprocessCupQualifier(supabase, eventId, organizer.id);

  revalidateCup([eventId, cup.final_event_id]);
  return processed ? "Classificatória adicionada e campeões já classificados!" : "Classificatória adicionada!";
}

export async function removeCupQualifier(formData: FormData) {
  await requireOrganizer();
  const supabase = await createClient();
  const cup = await loadCup(supabase, requiredId(formData, "cupId", "a copa"));
  const eventId = requiredId(formData, "eventId", "o racha");

  await clearCupQualificationsFromEvent(supabase, eventId);
  const { error } = await supabase.from("cup_qualifiers").delete().eq("cup_id", cup.id).eq("event_id", eventId);
  if (error) throw new Error(error.message);

  revalidateCup([eventId, cup.final_event_id]);
}

export async function reprocessQualifier(formData: FormData) {
  const organizer = await requireOrganizer();
  const supabase = await createClient();
  const cup = await loadCup(supabase, requiredId(formData, "cupId", "a copa"));
  const eventId = requiredId(formData, "eventId", "o racha");

  const processed = await reprocessCupQualifier(supabase, eventId, organizer.id);
  if (!processed) throw new Error("A final desse racha ainda não tem placar.");

  revalidateCup([eventId, cup.final_event_id]);
}

export async function setCupFinalEvent(formData: FormData) {
  await requireOrganizer();
  const supabase = await createClient();
  const cup = await loadCup(supabase, requiredId(formData, "cupId", "a copa"));
  const eventId = String(formData.get("eventId") ?? "").trim() || null;

  let finalDate = cup.final_date;
  if (eventId) {
    const event = await requireEventInCommunity(supabase, eventId, cup);
    const { data: qualifier } = await supabase.from("cup_qualifiers").select("id").eq("event_id", eventId).maybeSingle();
    if (qualifier) throw new Error("Esse racha é uma classificatória, não pode ser a final.");
    // A data da final passa a ser a do racha escolhido.
    finalDate = event.date;
  }

  const { error } = await supabase.from("cups").update({ final_event_id: eventId, final_date: finalDate }).eq("id", cup.id);
  if (error) throw new Error(error.message);

  let message = eventId ? "Final definida!" : "Final desvinculada.";
  if (eventId) {
    const result = await syncCupFinalList(supabase, { ...cup, final_event_id: eventId });
    if (result.added) message = `Final definida! ${result.added} classificado(s) colocado(s) na lista.`;
    if (result.failed) message += ` ${result.failed} não couberam — confira as vagas do racha.`;
  }

  revalidateCup([eventId, cup.final_event_id]);
  return message;
}

export async function setCupFinalDate(formData: FormData) {
  await requireOrganizer();
  const supabase = await createClient();
  const cup = await loadCup(supabase, requiredId(formData, "cupId", "a copa"));
  const finalDate = parseOptionalFinalDate(formData);
  if (finalDate && cup.qualifier_dates.some((date) => date >= finalDate)) {
    throw new Error("A final precisa ser depois da última classificatória.");
  }

  const { error } = await supabase.from("cups").update({ final_date: finalDate }).eq("id", cup.id);
  if (error) throw new Error(error.message);

  // Já existe racha nesse dia? Vira a final na hora e recebe os classificados.
  let linked = false;
  if (finalDate && !cup.final_event_id) {
    const { data: event } = await supabase
      .from("events")
      .select("id, date")
      .eq("community", cup.community)
      .eq("date", finalDate)
      .neq("status", "cancelled")
      .limit(1)
      .maybeSingle();
    if (event) {
      await linkEventToCup(supabase, { id: event.id, date: event.date, community: cup.community });
      linked = true;
    }
  }

  revalidateCup([cup.final_event_id]);
  if (!finalDate) return "Data da final marcada como a definir.";
  return linked ? "Data definida e racha desse dia ligado como final!" : "Data da final definida!";
}

export async function syncCupFinal(formData: FormData) {
  await requireOrganizer();
  const supabase = await createClient();
  const cup = await loadCup(supabase, requiredId(formData, "cupId", "a copa"));
  if (!cup.final_event_id) throw new Error("Defina primeiro qual racha é a final.");

  const result = await syncCupFinalList(supabase, cup);
  revalidateCup([cup.final_event_id]);
  if (result.failed) return `${result.added} colocado(s) na lista; ${result.failed} não couberam — confira as vagas do racha.`;
  return result.added ? `${result.added} classificado(s) colocado(s) na lista da final.` : "A lista da final já está com todos os classificados.";
}

export async function addCupPlayer(formData: FormData) {
  const organizer = await requireOrganizer();
  const supabase = await createClient();
  const cup = await loadCup(supabase, requiredId(formData, "cupId", "a copa"));
  const profileId = requiredId(formData, "profileId", "o jogador");

  const { error } = await supabase.from("cup_qualified_players").insert({
    cup_id: cup.id,
    profile_id: profileId,
    source: "manual",
    added_by: organizer.id,
  });
  if (error) {
    if (error.code === "23505") throw new Error("Essa pessoa já está classificada.");
    throw new Error(error.message);
  }
  const failed = await lockCupPlayersIntoFinal(supabase, cup.id, [profileId]);

  revalidateCup([cup.final_event_id]);
  if (failed.length) return "Classificado(a), mas não coube na lista da final — confira as vagas do racha.";
}

export async function fillCupSpotFromRanking(formData: FormData) {
  const organizer = await requireOrganizer();
  const supabase = await createClient();
  const cup = await loadCup(supabase, requiredId(formData, "cupId", "a copa"));

  const { data: qualified, error: qualifiedError } = await supabase
    .from("cup_qualified_players")
    .select("profile_id")
    .eq("cup_id", cup.id);
  if (qualifiedError) throw new Error(qualifiedError.message);
  if ((qualified?.length ?? 0) >= cup.num_teams * cup.team_size) throw new Error("Todas as vagas da copa já estão preenchidas.");

  const queue = await getCupRankingQueue(supabase, cup.community, new Set((qualified ?? []).map((row) => row.profile_id)));
  const next = queue[0];
  if (!next) throw new Error("Não há mais ninguém na fila do ranking.");

  const { error } = await supabase.from("cup_qualified_players").insert({
    cup_id: cup.id,
    profile_id: next.profileId,
    source: "ranking",
    ranking_position: next.position,
    added_by: organizer.id,
  });
  if (error) throw new Error(error.message);
  await lockCupPlayersIntoFinal(supabase, cup.id, [next.profileId]);

  revalidateCup([cup.final_event_id]);
  return `${next.fullName} entrou pela fila do ranking.`;
}

export async function removeCupPlayer(formData: FormData) {
  await requireOrganizer();
  const supabase = await createClient();
  const cup = await loadCup(supabase, requiredId(formData, "cupId", "a copa"));
  const profileId = requiredId(formData, "profileId", "o jogador");

  const { error } = await supabase.from("cup_qualified_players").delete().eq("cup_id", cup.id).eq("profile_id", profileId);
  if (error) throw new Error(error.message);
  await releaseCupPlayerFromFinal(supabase, cup.id, profileId);

  revalidateCup([cup.final_event_id]);
}
