"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { COPA_PATH } from "@/lib/copaVpa";

export type CupConfirmResult = { ok: true } | { ok: false; error: string };

// Em produção o Next esconde o texto de erro lançado numa server action, então
// o resultado volta como objeto. As regras (prazo, classificado, já pago) vêm
// do banco como mensagens escritas para o jogador (P0001).
async function callRule(rpc: "confirm_cup_presence_free" | "decline_cup_presence", cupId: string): Promise<CupConfirmResult> {
  if (!cupId) return { ok: false, error: "Copa inválida." };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Entre na sua conta novamente." };
  const { error } = await supabase.rpc(rpc, { p_cup_id: cupId });
  if (error) {
    if (error.code === "P0001") return { ok: false, error: error.message };
    console.error(`[copa-confirmacao] ${rpc}`, error.message);
    return { ok: false, error: "Não foi possível salvar agora. Tente de novo em instantes." };
  }
  revalidatePath(COPA_PATH);
  return { ok: true };
}

export async function confirmCupPresenceFree(cupId: string) {
  return callRule("confirm_cup_presence_free", cupId);
}

export async function declineCupPresence(cupId: string) {
  return callRule("decline_cup_presence", cupId);
}
