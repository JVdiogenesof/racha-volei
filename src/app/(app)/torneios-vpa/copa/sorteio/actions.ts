"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrganizer } from "@/lib/auth";
import { COPA_PATH, type Cup } from "@/lib/copaVpa";
import { prepareCupDraw, revealNextPick, saveCupScore } from "@/lib/copaDay";

async function loadCup(cupId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cups")
    .select("id, community, name, final_date, qualifier_dates, num_teams, team_size, final_event_id")
    .eq("id", cupId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Copa não encontrada.");
  return { supabase, cup: data as Cup };
}

function cupIdOf(formData: FormData) {
  const value = String(formData.get("cupId") ?? "").trim();
  if (!value) throw new Error("Copa não informada.");
  return value;
}

function refresh() {
  revalidatePath(COPA_PATH);
  revalidatePath(`${COPA_PATH}/sorteio`);
  revalidatePath(`${COPA_PATH}/jogos`);
}

/** Calcula o sorteio e deixa tudo escondido, pronto para a transmissão ao vivo. */
export async function prepareDraw(formData: FormData) {
  await requireOrganizer();
  const { supabase, cup } = await loadCup(cupIdOf(formData));
  const total = await prepareCupDraw(supabase, cup);
  refresh();
  return `Sorteio pronto com ${total} jogadores. Aperte Iniciar quando a galera estiver olhando.`;
}

export async function revealNext(formData: FormData) {
  await requireOrganizer();
  const { supabase, cup } = await loadCup(cupIdOf(formData));
  const result = await revealNextPick(supabase, cup);
  if (result.finished) refresh();
  return JSON.stringify(result);
}

export async function resetDraw(formData: FormData) {
  await requireOrganizer();
  const { supabase, cup } = await loadCup(cupIdOf(formData));
  const { error } = await supabase.from("cup_teams").delete().eq("cup_id", cup.id);
  if (error) throw new Error(error.message);
  refresh();
  return "Sorteio e jogos apagados.";
}

export async function saveScore(formData: FormData) {
  await requireOrganizer();
  const { supabase, cup } = await loadCup(cupIdOf(formData));
  const matchId = String(formData.get("matchId") ?? "");
  const scoreA = Number(formData.get("scoreA"));
  const scoreB = Number(formData.get("scoreB"));
  if (!matchId || !Number.isInteger(scoreA) || !Number.isInteger(scoreB) || scoreA < 0 || scoreB < 0 || scoreA > 99 || scoreB > 99) {
    throw new Error("Informe um placar válido.");
  }
  await saveCupScore(supabase, cup, matchId, scoreA, scoreB);
  refresh();
  return "Placar salvo.";
}
