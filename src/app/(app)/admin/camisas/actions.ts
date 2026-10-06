"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrganizer } from "@/lib/auth";
import { getActiveCommunity } from "@/lib/community";

export async function setShirtOrderPaid(formData: FormData) {
  const organizer = await requireOrganizer();
  const community = await getActiveCommunity(organizer);
  const profileId = String(formData.get("profileId") ?? "");
  const payment = String(formData.get("payment") ?? "");
  const ids = formData.getAll("orderId").map(String);
  if (!profileId || !ids.length || !["pending", "half", "paid"].includes(payment)) throw new Error("Pedido inválido.");
  const supabase = await createClient();
  const received = payment !== "pending";
  const { data, error } = await supabase.from("shirt_orders").update({
    paid: payment === "paid",
    half_paid: payment === "half",
    paid_at: received ? new Date().toISOString() : null,
    marked_by: received ? organizer.id : null,
    updated_at: new Date().toISOString(),
  }).eq("profile_id", profileId).eq("community", community).in("id", ids).select("id");
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error("Pedido não encontrado.");
  revalidatePath("/admin/camisas");
  revalidatePath("/camisas");
  revalidatePath("/admin/financas");
}

export async function deleteShirtOrder(formData: FormData) {
  const organizer = await requireOrganizer();
  const community = await getActiveCommunity(organizer);
  const orderId = String(formData.get("orderId") ?? "");
  if (!orderId) throw new Error("Pedido inválido.");

  const supabase = await createClient();
  const { data: order, error: lookupError } = await supabase.from("shirt_orders")
    .select("id, paid, half_paid").eq("id", orderId).eq("community", community).maybeSingle();
  if (lookupError) throw new Error(lookupError.message);
  if (!order) throw new Error("Pedido não encontrado nesta modalidade.");
  if (order.paid || order.half_paid) throw new Error("Marque o pedido como não pago antes de excluí-lo, para o caixa ser corrigido.");
  const { data, error } = await supabase
    .from("shirt_orders")
    .delete()
    .eq("id", orderId)
    .eq("community", community)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Pedido não encontrado nesta modalidade.");

  revalidatePath("/admin/camisas");
  revalidatePath("/camisas");
  revalidatePath("/admin/financas");
}
