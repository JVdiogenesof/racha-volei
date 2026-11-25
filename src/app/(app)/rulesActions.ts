"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { RULES_VERSION } from "@/lib/rulesVersion";

/** Grava o aceite da versão vigente do regulamento para a pessoa logada. */
export async function acceptRules() {
  await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_rules", { p_version: RULES_VERSION });
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}
