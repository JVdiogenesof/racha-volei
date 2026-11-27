import "server-only";
import { createClient as createServiceClient, type SupabaseClient } from "@supabase/supabase-js";
import { getMercadoPagoOrder, isApprovedMercadoPagoOrder } from "@/lib/mercadoPago";

/** Referência enviada ao Mercado Pago: o prefixo separa as doações dos rachas e da Copa. */
export const DONATION_PIX_REFERENCE_PREFIX = "vpadoa_";

function serviceClient(): SupabaseClient | null {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return null;
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export type DonationSettleResult = "paid" | "pending" | "unknown";

/** Conclui a doação de um pedido já pago. "unknown" = o pedido não é de doação. */
export async function settleApprovedDonationOrder(orderId: string): Promise<DonationSettleResult> {
  const supabase = serviceClient();
  if (!supabase) throw new Error("SUPABASE_SERVICE_ROLE_KEY ausente.");
  const { data: intent, error } = await supabase
    .from("donation_intents")
    .select("id, status")
    .eq("provider", "mercado_pago")
    .eq("provider_order_id", orderId)
    .maybeSingle();
  if (error || !intent) return "unknown";
  if (intent.status === "paid") return "paid";
  const { error: completeError } = await supabase.rpc("complete_donation_pix_payment", {
    p_intent_id: intent.id,
    p_provider_order_id: orderId,
  });
  if (completeError) throw new Error(completeError.message);
  return "paid";
}

/** Confere no Mercado Pago e conclui, se já foi pago. */
export async function settleDonationOrder(orderId: string): Promise<DonationSettleResult> {
  const order = await getMercadoPagoOrder(orderId);
  if (!isApprovedMercadoPagoOrder(order)) return "pending";
  return settleApprovedDonationOrder(orderId);
}

/**
 * Confere os Pix de doação ainda abertos de uma pessoa (últimos 40 minutos),
 * para o pagamento aparecer mesmo se o aviso do Mercado Pago atrasar. Nunca lança erro.
 */
export async function reconcileDonationPayments(profileId: string): Promise<number> {
  try {
    const supabase = serviceClient();
    if (!supabase) return 0;
    const since = new Date(Date.now() - 40 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from("donation_intents")
      .select("provider_order_id")
      .eq("profile_id", profileId)
      .in("status", ["pending", "expired"])
      .not("provider_order_id", "is", null)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(5);
    const results = await Promise.all(
      (data ?? []).map((row) =>
        settleDonationOrder(row.provider_order_id as string).catch((error) => {
          console.error("[doacao-pix-reconcile] Falha ao conferir pedido", error instanceof Error ? error.message : error);
          return "unknown" as const;
        }),
      ),
    );
    return results.filter((result) => result === "paid").length;
  } catch (error) {
    console.error("[doacao-pix-reconcile] Falha", error instanceof Error ? error.message : error);
    return 0;
  }
}
