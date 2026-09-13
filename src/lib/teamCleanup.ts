import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Remove alguém da geração de times mais recente de um racha, se ela estiver
 * lá. Chamado sempre que a pessoa deixa de estar confirmada (cancela sozinha,
 * o organizador tira, ou volta pra interessados) — assim ninguém fica presa
 * num time depois de sair da lista de confirmados.
 */
export async function removeFromCurrentTeam(supabase: SupabaseClient, eventId: string, profileId: string) {
  const { data: generation } = await supabase
    .from("team_generations")
    .select("id")
    .eq("event_id", eventId)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!generation) return;

  const { data: teamRows } = await supabase.from("teams").select("id").eq("generation_id", generation.id);
  const teamIds = (teamRows ?? []).map((t) => t.id);
  if (!teamIds.length) return;

  await supabase.from("team_members").delete().eq("profile_id", profileId).in("team_id", teamIds);
}
