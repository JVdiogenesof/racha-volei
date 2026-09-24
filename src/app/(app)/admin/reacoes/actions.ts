"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrganizer } from "@/lib/auth";

export async function setQueridometroTypeActive(formData: FormData) {
  await requireOrganizer();
  const supabase = await createClient();
  const key = String(formData.get("key") ?? "");
  const active = String(formData.get("active")) === "true";

  const { error } = await supabase.from("queridometro_reaction_types").update({ active }).eq("key", key);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/reacoes");
  revalidatePath("/reacoes");
}
