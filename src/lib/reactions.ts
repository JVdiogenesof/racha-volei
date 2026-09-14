import type { SupabaseClient } from "@supabase/supabase-js";

/** Reações mais velhas que isso somem sozinhas -- mantém o banco sempre pequeno. */
export const REACTION_RETENTION_DAYS = 10;

/** Apaga reações antigas. Chamado sempre que a página do feed é aberta. */
export async function pruneOldReactions(supabase: SupabaseClient) {
  const cutoff = new Date(Date.now() - REACTION_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await supabase.from("reactions").delete().lt("created_at", cutoff);
}

/** Substitui "{alvo}" pelo nome de quem recebeu a reação. */
export function renderReactionText(template: string, targetName: string) {
  return template.includes("{alvo}") ? template.replace(/\{alvo\}/g, targetName) : `${template} ${targetName}`;
}
