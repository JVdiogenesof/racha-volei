"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireMember } from "@/lib/auth";
import { SHIRT_MODELS, SHIRT_SIZES, SHIRT_FITS, type ShirtModel } from "@/lib/shirts";
import { getActiveCommunity } from "@/lib/community";

export type ShirtOrderState = { status: "idle" | "success" | "error"; message: string };

export async function saveShirtOrder(
  _previousState: ShirtOrderState,
  formData: FormData,
): Promise<ShirtOrderState> {
  const profile = await requireMember();
  const supabase = await createClient();
  const community = await getActiveCommunity(profile);
  const model = String(formData.get("model") ?? "") as ShirtModel;
  const shirtName = String(formData.get("shirtName") ?? "").trim();
  const shirtNumberText = String(formData.get("shirtNumber") ?? "").trim();
  const size = String(formData.get("size") ?? "").toUpperCase();
  const quantity = Number(formData.get("quantity"));
  const fit = String(formData.get("fit") ?? "");
  if (!(fit === "regular" || fit === "female")) return { status: "error", message: "Escolha a modelagem." };

  if (!(model in SHIRT_MODELS)) return { status: "error", message: "Escolha um modelo de camisa." };
  if (!shirtName || shirtName.length > 20) return { status: "error", message: "O nome deve ter entre 1 e 20 caracteres." };
  if (!/^\d{1,2}$/.test(shirtNumberText)) return { status: "error", message: "Escolha um número entre 0 e 99." };
  if (!SHIRT_SIZES.includes(size as (typeof SHIRT_SIZES)[number])) return { status: "error", message: "Escolha um tamanho válido." };
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) return { status: "error", message: "A quantidade deve ficar entre 1 e 20." };

  const { data: existing, error: lookupError } = await supabase
    .from("shirt_orders")
    .select("id, paid, half_paid")
    .eq("profile_id", profile.id)
    .eq("model", model)
    .eq("community", community)
    .maybeSingle();
  if (lookupError) return { status: "error", message: lookupError.message };
  if (existing?.paid || existing?.half_paid) return { status: "error", message: "Este pedido já foi pago e não pode mais ser alterado." };

  const values = {
    fit,
    shirt_name: shirtName,
    shirt_number: Number(shirtNumberText),
    size,
    quantity,
    updated_at: new Date().toISOString(),
  };
  const result = existing
    ? await supabase.from("shirt_orders").update(values).eq("id", existing.id).eq("profile_id", profile.id).eq("community", community).eq("paid", false).eq("half_paid", false).select("id")
    : await supabase.from("shirt_orders").insert({ ...values, profile_id: profile.id, model, community }).select("id");

  if (result.error) return { status: "error", message: result.error.message };
  if (!result.data?.length) return { status: "error", message: "O pedido mudou. Atualize a página antes de tentar novamente." };
  revalidatePath("/camisas");
  revalidatePath("/admin/camisas");
  return {
    status: "success",
    message: existing ? `Pedido do modelo ${SHIRT_MODELS[model].label} atualizado!` : `Pedido do modelo ${SHIRT_MODELS[model].label} confirmado!`,
  };
}

export async function cancelShirtOrder(formData: FormData) {
  const profile = await requireMember();
  const supabase = await createClient();
  const community = await getActiveCommunity(profile);
  const orderId = String(formData.get("orderId") ?? "");
  const { data, error } = await supabase
    .from("shirt_orders")
    .delete()
    .eq("id", orderId)
    .eq("profile_id", profile.id)
    .eq("community", community)
    .eq("paid", false).eq("half_paid", false).select("id");
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error("Este item não pode ser cancelado. Atualize a página.");
  revalidatePath("/camisas");
  revalidatePath("/admin/camisas");
}

export async function updateShirtFit(formData: FormData) {
  const profile = await requireMember();
  const community = await getActiveCommunity(profile);
  const fit = String(formData.get("fit"));
  if (!Object.hasOwn(SHIRT_FITS, fit) || fit === "unspecified") throw new Error("Escolha Feminina ou Tradicional.");
  const supabase = await createClient();
  const { data, error } = await supabase.from("shirt_orders")
    .update({ fit, updated_at: new Date().toISOString() })
    .eq("id", String(formData.get("orderId"))).eq("profile_id", profile.id).eq("community", community)
    .select("id").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Pedido não encontrado.");
  revalidatePath("/camisas");
  revalidatePath("/admin/camisas");
}
