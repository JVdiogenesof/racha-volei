import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Quem conta como levantador NESTE racha. Para quem está confirmado vale a
 * vaga que ocupou (uses_setter_spot): só os primeiros levantadores (1 a cada 6
 * vagas) ocupam vaga de levantador; os que entram depois da cota cheia entram
 * e contam como jogadores normais, mesmo sendo levantadores no perfil.
 * Para os demais, vale a marcação manual do racha (event_setter_overrides).
 */
export async function withConfirmedSetterSpots(
  supabase: SupabaseClient,
  eventId: string,
  overrides: Map<string, boolean>,
) {
  const { data } = await supabase
    .from("attendance")
    .select("profile_id, uses_setter_spot")
    .eq("event_id", eventId)
    .eq("status", "confirmed");
  const merged = new Map(overrides);
  for (const row of data ?? []) merged.set(row.profile_id, Boolean(row.uses_setter_spot));
  return merged;
}
