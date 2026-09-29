"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrganizer } from "@/lib/auth";

export async function setShirtOrderPaid(formData: FormData) {
  const organizer = await requireOrganizer();
  const supabase = await createClient();
  const orderId = String(formData.get("orderId") ?? "");
  const paid = String(formData.get("paid")) === "true";
  if (!orderId) throw new Error("Pedido inválido.");

  const { data, error } = await supabase
    .from("shirt_orders")
    .update({
      paid,
      paid_at: paid ? new Date().toISOString() : null,
      marked_by: paid ? organizer.id : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Pedido não encontrado.");
  revalidatePath("/admin/camisas");
  revalidatePath("/camisas");
}
