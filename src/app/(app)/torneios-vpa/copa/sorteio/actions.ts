"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrganizer } from "@/lib/auth";
import { COPA_PATH, type Cup } from "@/lib/copaVpa";
import { loadSavedDrawPlan, prepareCupDraw, revealNextPick, saveCupScore, saveManualDrawPlan, simulateCupDraw, type SimulatedDraw } from "@/lib/copaDay";

/**
 * Em produção o Next esconde o texto do erro lançado numa server action
 * ("An error occurred..."), então o sorteio devolve o resultado como objeto:
 * o organizador vê a mensagem certa (ex.: quantos confirmados faltam).
 */
export type DrawActionResult =
  | { ok: true; message: string; remaining?: number; finished?: boolean }
  | { ok: false; error: string };

const CUP_SELECT =
  "id, community, name, final_date, qualifier_dates, num_teams, team_size, final_event_id, confirm_amount, confirm_deadline";

async function loadCup(cupId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("cups").select(CUP_SELECT).eq("id", cupId).maybeSingle();
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

async function guarded(run: () => Promise<DrawActionResult>): Promise<DrawActionResult> {
  try {
    await requireOrganizer();
    return await run();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível concluir a ação.";
    console.error("[copa-sorteio]", message);
    return { ok: false, error: message };
  }
}

/** Calcula o sorteio e deixa tudo escondido, pronto para a transmissão ao vivo. */
export async function prepareDraw(formData: FormData): Promise<DrawActionResult> {
  return guarded(async () => {
    const { supabase, cup } = await loadCup(cupIdOf(formData));
    const total = await prepareCupDraw(supabase, cup);
    refresh();
    return { ok: true, message: `Sorteio pronto com ${total} jogadores. Aperte Iniciar quando a galera estiver olhando.` };
  });
}

export type SimulateDrawResult = { ok: true; draw: SimulatedDraw } | { ok: false; error: string };

/** Prévia do sorteio para o organizador: mesmo algoritmo, nada é gravado nem revelado. */
export async function simulateDraw(formData: FormData): Promise<SimulateDrawResult> {
  try {
    await requireOrganizer();
    const { supabase, cup } = await loadCup(cupIdOf(formData));
    return { ok: true, draw: await simulateCupDraw(supabase, cup) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível simular o sorteio.";
    console.error("[copa-sorteio-simulacao]", message);
    return { ok: false, error: message };
  }
}

/** Abre os times já salvos (ainda escondidos) para os organizadores editarem. */
export async function loadSavedPlan(formData: FormData): Promise<SimulateDrawResult> {
  try {
    await requireOrganizer();
    const { supabase, cup } = await loadCup(cupIdOf(formData));
    return { ok: true, draw: await loadSavedDrawPlan(supabase, cup) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível abrir os times salvos.";
    console.error("[copa-sorteio-editar]", message);
    return { ok: false, error: message };
  }
}

/** Salva os times montados na simulação (com trocas) para a revelação ao vivo. */
export async function saveDrawPlan(formData: FormData): Promise<DrawActionResult> {
  return guarded(async () => {
    const { supabase, cup } = await loadCup(cupIdOf(formData));
    let teams: unknown;
    try {
      teams = JSON.parse(String(formData.get("teams") ?? ""));
    } catch {
      throw new Error("Times inválidos.");
    }
    if (!Array.isArray(teams) || teams.some((team) => !Array.isArray(team) || team.some((id) => typeof id !== "string"))) {
      throw new Error("Times inválidos.");
    }
    const total = await saveManualDrawPlan(supabase, cup, teams as string[][]);
    refresh();
    return { ok: true, message: `Times salvos (${total} jogadores). Na live, aperte Iniciar para revelar.` };
  });
}

export async function revealNext(formData: FormData): Promise<DrawActionResult> {
  return guarded(async () => {
    const { supabase, cup } = await loadCup(cupIdOf(formData));
    const result = await revealNextPick(supabase, cup);
    if (result.finished) refresh();
    return { ok: true, message: "", remaining: result.remaining, finished: result.finished };
  });
}

export async function resetDraw(formData: FormData): Promise<DrawActionResult> {
  return guarded(async () => {
    const { supabase, cup } = await loadCup(cupIdOf(formData));
    const { error } = await supabase.from("cup_teams").delete().eq("cup_id", cup.id);
    if (error) throw new Error(error.message);
    refresh();
    return { ok: true, message: "Sorteio e jogos apagados." };
  });
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
