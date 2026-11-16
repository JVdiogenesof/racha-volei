import { createClient } from "@/lib/supabase/server";
import { createPixOrder, getMercadoPagoOrder, pixDataFromOrder } from "@/lib/mercadoPago";
import { CUP_PIX_REFERENCE_PREFIX } from "@/lib/copaConfirm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// P0001 = `raise exception` das funções do banco: regra de negócio (fora do
// prazo, não classificado, já pago). Qualquer outro erro é técnico e pode ser
// repetido sem risco, pois a cobrança em aberto é reaproveitada.
const BUSINESS_RULE_ERROR = "P0001";
const GENERIC_FAILURE = "Não conseguimos gerar o Pix agora.";

export async function POST(request: Request) {
  let cupId: string | undefined;
  try {
    const body = (await request.json()) as { cupId?: string };
    if (!body.cupId) return Response.json({ error: "Copa inválida.", blocked: true }, { status: 400 });
    cupId = body.cupId;

    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user?.email) return Response.json({ error: "Entre na sua conta novamente.", blocked: true }, { status: 401 });

    const { data: started, error: startError } = await supabase.rpc("begin_cup_payment", { p_cup_id: body.cupId });
    if (startError) {
      if (startError.code !== BUSINESS_RULE_ERROR) throw new Error(startError.message);
      const alreadyPaid = startError.message.includes("já está pago");
      return Response.json({ error: startError.message, blocked: true, alreadyPaid }, { status: 409 });
    }
    const intentId = started?.[0]?.payment_intent_id as string | undefined;
    if (!intentId) throw new Error("A cobrança não foi devolvida pelo banco.");

    const { data: intent, error: intentError } = await supabase
      .from("cup_payment_intents")
      .select("id, amount, provider_order_id, provider_reference, expires_at")
      .eq("id", intentId)
      .maybeSingle();
    if (intentError || !intent) throw new Error(intentError?.message || "Cobrança não encontrada.");

    const reference = intent.provider_reference || `${CUP_PIX_REFERENCE_PREFIX}${intent.id}`;
    const order = intent.provider_order_id
      ? await getMercadoPagoOrder(intent.provider_order_id)
      : await createPixOrder({
          amount: Number(intent.amount).toFixed(2),
          externalReference: reference,
          payerEmail: auth.user.email,
          idempotencyKey: intent.id,
        });

    if (!intent.provider_order_id) {
      const { error: attachError } = await supabase.rpc("attach_cup_payment_provider_order", {
        p_intent_id: intent.id,
        p_provider_order_id: order.id,
        p_provider_reference: reference,
      });
      if (attachError) {
        // Duas abas ao mesmo tempo: a outra já ligou esta mesma cobrança.
        const { data: current } = await supabase.from("cup_payment_intents").select("provider_order_id").eq("id", intent.id).maybeSingle();
        if (current?.provider_order_id !== order.id) throw new Error(attachError.message);
      }
    }

    return Response.json({
      ...pixDataFromOrder(order),
      amount: Number(intent.amount),
      // O código Pix vale até aqui; a contagem usa o relógio do servidor.
      reservationExpiresAt: intent.expires_at,
      serverNow: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : GENERIC_FAILURE;
    console.error("[copa-pix-create] Não foi possível criar a cobrança", { cupId, message });
    const friendly = message.startsWith("O Mercado Pago") ? message : GENERIC_FAILURE;
    return Response.json({ error: friendly }, { status: 503 });
  }
}
