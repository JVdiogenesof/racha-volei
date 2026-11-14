import "server-only";
import { after } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { getMercadoPagoOrder, isApprovedMercadoPagoOrder } from "@/lib/mercadoPago";
import { notifyPixSettled } from "@/lib/listNotifications";

/**
 * Confere o pedido no Mercado Pago e, se já foi pago, conclui a reserva
 * (confirma a pessoa na lista). Serve ao webhook e à conferência feita pela
 * própria tela, então o pagamento não depende só do aviso do provedor.
 */
export async function settleMercadoPagoOrder(orderId: string): Promise<"paid" | "pending" | "unknown"> {
  const order = await getMercadoPagoOrder(orderId);
  if (!isApprovedMercadoPagoOrder(order)) return "pending";

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY ausente.");
  const supabase = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: intent, error: intentError } = await supabase
    .from("event_payment_intents")
    .select("id, status")
    .eq("provider", "mercado_pago")
    .eq("provider_order_id", orderId)
    .maybeSingle();
  if (intentError || !intent) return "unknown";
  if (intent.status === "paid") return "paid";

  const { error } = await supabase.rpc("complete_event_pix_payment", {
    p_intent_id: intent.id,
    p_provider_order_id: orderId,
  });
  if (error?.message.includes("reserva já expirou")) {
    const { error: creditError } = await supabase.rpc("credit_late_event_pix_payment", {
      p_intent_id: intent.id,
      p_provider_order_id: orderId,
    });
    if (creditError) throw new Error(creditError.message);
  } else if (error) {
    throw new Error(error.message);
  }
  await notifyPixSettled(supabase, intent.id);
  return "paid";
}

/**
 * Confere os Pix ainda abertos de um racha (a cobrança dura 30 minutos no
 * Mercado Pago). Roda quando a tela do racha abre, então o pagamento é
 * reconhecido mesmo se o aviso (webhook) do Mercado Pago não chegar.
 * Nunca lança erro: uma falha aqui não pode quebrar a página.
 */
export async function reconcileEventPayments(eventId: string, profileId?: string): Promise<number> {
  try {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) return 0;
    const supabase = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const since = new Date(Date.now() - 40 * 60 * 1000).toISOString();
    let query = supabase
      .from("event_payment_intents")
      .select("provider_order_id")
      .eq("event_id", eventId)
      .eq("provider", "mercado_pago")
      .in("status", ["pending", "expired"])
      .not("provider_order_id", "is", null)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(10);
    if (profileId) query = query.eq("profile_id", profileId);
    const { data } = await query;
    const results = await Promise.all(
      (data ?? []).map((row) =>
        row.provider_order_id
          ? settleMercadoPagoOrder(row.provider_order_id).catch((error) => {
              console.error("[pix-reconcile] Falha ao conferir pedido", error instanceof Error ? error.message : error);
              return "unknown" as const;
            })
          : Promise.resolve("unknown" as const),
      ),
    );
    return results.filter((result) => result === "paid").length;
  } catch (error) {
    console.error("[pix-reconcile] Falha", error instanceof Error ? error.message : error);
    return 0;
  }
}

/**
 * Para quem abre a tela: confere os Pix, mas não segura a página se o Mercado
 * Pago estiver lento (ele pode levar até 25s para responder). O que não
 * terminar a tempo continua depois da resposta.
 */
export async function reconcileWithinBudget(eventId: string, profileId?: string, budgetMs = 1500) {
  const work = reconcileEventPayments(eventId, profileId);
  after(() => work);
  await Promise.race([work, new Promise((resolve) => setTimeout(resolve, budgetMs))]);
}
