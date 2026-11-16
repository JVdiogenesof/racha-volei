import "server-only";
import { createClient as createServiceClient, type SupabaseClient } from "@supabase/supabase-js";
import { getMercadoPagoOrder, isApprovedMercadoPagoOrder } from "@/lib/mercadoPago";

/** Referência enviada ao Mercado Pago: o prefixo separa cobranças da Copa das dos rachas. */
export const CUP_PIX_REFERENCE_PREFIX = "vpacup_";

function serviceClient(): SupabaseClient | null {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return null;
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export type CupSettleResult = "paid" | "refund_needed" | "pending" | "unknown";

/**
 * Conclui a confirmação da Copa a partir de um pedido que o Mercado Pago já
 * confirmou como pago. "unknown" = o pedido não é de nenhuma cobrança da Copa.
 */
export async function settleApprovedCupOrder(orderId: string): Promise<CupSettleResult> {
  const supabase = serviceClient();
  if (!supabase) throw new Error("SUPABASE_SERVICE_ROLE_KEY ausente.");
  const { data: intent, error } = await supabase
    .from("cup_payment_intents")
    .select("id, status")
    .eq("provider", "mercado_pago")
    .eq("provider_order_id", orderId)
    .maybeSingle();
  if (error || !intent) return "unknown";
  if (intent.status === "paid") return "paid";
  if (intent.status === "refund_needed" || intent.status === "refunded") return "refund_needed";

  const { data: result, error: completeError } = await supabase.rpc("complete_cup_pix_payment", {
    p_intent_id: intent.id,
    p_provider_order_id: orderId,
  });
  if (completeError) throw new Error(completeError.message);
  return result === "paid" ? "paid" : "refund_needed";
}

/** Confere no Mercado Pago e conclui, se já foi pago. */
export async function settleCupOrder(orderId: string): Promise<CupSettleResult> {
  const order = await getMercadoPagoOrder(orderId);
  if (!isApprovedMercadoPagoOrder(order)) return "pending";
  return settleApprovedCupOrder(orderId);
}

/**
 * Confere os Pix ainda abertos de uma pessoa na Copa (o código vale 30
 * minutos). Roda quando a tela confere o pagamento. Nunca lança erro.
 */
export async function reconcileCupPayments(cupId: string, profileId: string): Promise<number> {
  try {
    const supabase = serviceClient();
    if (!supabase) return 0;
    const since = new Date(Date.now() - 40 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from("cup_payment_intents")
      .select("provider_order_id")
      .eq("cup_id", cupId)
      .eq("profile_id", profileId)
      .in("status", ["pending", "expired"])
      .not("provider_order_id", "is", null)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(5);
    const results = await Promise.all(
      (data ?? []).map((row) =>
        row.provider_order_id
          ? settleCupOrder(row.provider_order_id).catch((error) => {
              console.error("[copa-pix-reconcile] Falha ao conferir pedido", error instanceof Error ? error.message : error);
              return "unknown" as const;
            })
          : Promise.resolve("unknown" as const),
      ),
    );
    return results.filter((result) => result === "paid").length;
  } catch (error) {
    console.error("[copa-pix-reconcile] Falha", error instanceof Error ? error.message : error);
    return 0;
  }
}

/** Organização registra que devolveu o valor de um Pix pago fora do prazo / sem vaga. */
export async function markCupPaymentRefunded(intentId: string) {
  const supabase = serviceClient();
  if (!supabase) throw new Error("SUPABASE_SERVICE_ROLE_KEY ausente.");
  const { data, error } = await supabase
    .from("cup_payment_intents")
    .update({ status: "refunded" })
    .eq("id", intentId)
    .eq("status", "refund_needed")
    .select("id");
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error("Essa devolução já foi registrada.");
}
