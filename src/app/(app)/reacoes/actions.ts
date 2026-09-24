"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { getEligibleQueridometroProfiles, getQueridometroPeriod } from "@/lib/queridometro";

export async function setWeeklyReaction(formData: FormData) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const toProfileId = String(formData.get("toProfileId") ?? "");
  const reactionKey = String(formData.get("reactionKey") ?? "");
  const period = getQueridometroPeriod();

  if (!period.votingOpen) throw new Error("A votação encerrou. Hoje é dia de ver o resultado!");
  if (!toProfileId || !reactionKey) throw new Error("Escolha uma pessoa e uma reação.");
  if (toProfileId === profile.id) throw new Error("Você não pode reagir a si mesmo.");

  const [eligibleProfiles, { data: reactionType }] = await Promise.all([
    getEligibleQueridometroProfiles(supabase),
    supabase.from("queridometro_reaction_types").select("key, active").eq("key", reactionKey).maybeSingle(),
  ]);
  const eligibleIds = new Set(eligibleProfiles.map((item) => item.id));
  if (!eligibleIds.has(profile.id) || !eligibleIds.has(toProfileId)) {
    throw new Error("O Queridômetro desta semana é para quem participou dos rachas recentes.");
  }
  if (!reactionType?.active) throw new Error("Essa reação não está disponível.");

  const { error } = await supabase.from("queridometro_votes").upsert(
    {
      week_start: period.weekStart,
      from_profile_id: profile.id,
      to_profile_id: toProfileId,
      reaction_key: reactionKey,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "week_start,from_profile_id,to_profile_id" },
  );
  if (error) throw new Error(error.message);
  revalidatePath("/reacoes");
}

export async function clearWeeklyReaction(formData: FormData) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const toProfileId = String(formData.get("toProfileId") ?? "");
  const period = getQueridometroPeriod();

  if (!period.votingOpen) throw new Error("A votação desta semana já encerrou.");
  const { error } = await supabase
    .from("queridometro_votes")
    .delete()
    .eq("week_start", period.weekStart)
    .eq("from_profile_id", profile.id)
    .eq("to_profile_id", toProfileId);
  if (error) throw new Error(error.message);
  revalidatePath("/reacoes");
}
