"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrganizer } from "@/lib/auth";
import { getActiveCommunity } from "@/lib/community";
import { SHIRT_FITS, SHIRT_MODELS, SHIRT_SIZES, SHIRT_ORDER_STATUS_LABELS } from "@/lib/shirts";

export async function setShirtOrderStatus(formData: FormData) {
  const organizer = await requireOrganizer();
  const community = await getActiveCommunity(organizer);
  const orderId = String(formData.get("orderId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!orderId || !Object.hasOwn(SHIRT_ORDER_STATUS_LABELS, status)) throw new Error("Status do pedido inválido.");
  const supabase = await createClient();
  const { data, error } = await supabase.from("shirt_orders")
    .update({ fulfillment_status: status, updated_at: new Date().toISOString() })
    .eq("id", orderId).eq("community", community).select("id").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Pedido não encontrado nesta modalidade.");
  revalidatePath("/admin/camisas");
  revalidatePath("/camisas");
}

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
    .select("id, paid, half_paid, paid_at, marked_by").eq("id", orderId).eq("community", community).maybeSingle();
  if (lookupError) throw new Error(lookupError.message);
  if (!order) throw new Error("Pedido não encontrado nesta modalidade.");

  // O gatilho do banco estorna as parcelas no caixa quando o pedido volta a
  // pendente. Fazemos isso antes da exclusão para não deixar receita órfã.
  if (order.paid || order.half_paid) {
    const { error: resetError } = await supabase.from("shirt_orders").update({
      paid: false,
      half_paid: false,
      paid_at: null,
      marked_by: null,
      updated_at: new Date().toISOString(),
    }).eq("id", orderId).eq("community", community);
    if (resetError) throw new Error(resetError.message);
  }

  const { data, error } = await supabase
    .from("shirt_orders")
    .delete()
    .eq("id", orderId)
    .eq("community", community)
    .select("id")
    .maybeSingle();
  if (error || !data) {
    if (order.paid || order.half_paid) {
      await supabase.from("shirt_orders").update({
        paid: order.paid,
        half_paid: order.half_paid,
        paid_at: order.paid_at,
        marked_by: order.marked_by,
        updated_at: new Date().toISOString(),
      }).eq("id", orderId).eq("community", community);
    }
    throw new Error(error?.message ?? "Pedido não encontrado nesta modalidade.");
  }

  revalidatePath("/admin/camisas");
  revalidatePath("/camisas");
  revalidatePath("/admin/financas");
}

export async function updateShirtOrder(formData: FormData) {
  const organizer = await requireOrganizer();
  const community = await getActiveCommunity(organizer);
  const orderId = String(formData.get("orderId") ?? "");
  const model = String(formData.get("model") ?? "");
  const fit = String(formData.get("fit") ?? "");
  const shirtName = String(formData.get("shirtName") ?? "").trim();
  const shirtNumberText = String(formData.get("shirtNumber") ?? "").trim();
  const size = String(formData.get("size") ?? "");
  const quantity = Number(formData.get("quantity"));

  if (!orderId) throw new Error("Pedido inválido.");
  if (!(model in SHIRT_MODELS)) throw new Error("Escolha um modelo válido.");
  if (!(fit in SHIRT_FITS)) throw new Error("Escolha uma modelagem válida.");
  if (!shirtName || shirtName.length > 20) throw new Error("O nome deve ter entre 1 e 20 caracteres.");
  if (!/^\d{1,2}$/.test(shirtNumberText)) throw new Error("Escolha um número entre 0 e 99.");
  if (!(SHIRT_SIZES as readonly string[]).includes(size)) throw new Error("Escolha um tamanho válido.");
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) throw new Error("A quantidade deve ficar entre 1 e 20.");

  const supabase = await createClient();
  const { data, error } = await supabase.from("shirt_orders").update({
    model,
    fit,
    shirt_name: shirtName,
    shirt_number: Number(shirtNumberText),
    size,
    quantity,
    updated_at: new Date().toISOString(),
  }).eq("id", orderId).eq("community", community).select("id").maybeSingle();

  if (error?.code === "23505") throw new Error("Essa pessoa já possui um pedido deste modelo nesta modalidade.");
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Pedido não encontrado nesta modalidade.");

  revalidatePath("/admin/camisas");
  revalidatePath("/camisas");
  revalidatePath("/admin/financas");
}
