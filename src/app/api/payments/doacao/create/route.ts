import { createClient } from "@/lib/supabase/server";
import { createPixOrder, pixDataFromOrder } from "@/lib/mercadoPago";
import { DONATION_PIX_REFERENCE_PREFIX } from "@/lib/donations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// P0001 = `raise exception` das funções do banco: regra (valor, campanha encerrada).
const BUSINESS_RULE_ERROR = "P0001";
const GENERIC_FAILURE = "Não conseguimos gerar o Pix agora.";

export async function POST(request: Request) {
  let campaignId: string | undefined;
  try {
    const body = (await request.json()) as { campaignId?: string; amount?: number };
    campaignId = body.campaignId;
    const amount = Number(body.amount);
    if (!campaignId) return Response.json({ error: "Campanha inválida.", blocked: true }, { status: 400 });
    if (!Number.isFinite(amount)) return Response.json({ error: "Informe o valor.", blocked: true }, { status: 400 });

    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user?.email) return Response.json({ error: "Entre na sua conta novamente.", blocked: true }, { status: 401 });

    const { data: started, error: startError } = await supabase.rpc("begin_donation", {
      p_campaign_id: campaignId,
      p_amount: Math.round(amount * 100) / 100,
    });
    if (startError) {
      if (startError.code !== BUSINESS_RULE_ERROR) throw new Error(startError.message);
      return Response.json({ error: startError.message, blocked: true }, { status: 409 });
    }
    const intentId = started?.[0]?.payment_intent_id as string | undefined;
    if (!intentId) throw new Error("A cobrança não foi devolvida pelo banco.");

    const { data: intent, error: intentError } = await supabase
      .from("donation_intents")
      .select("id, amount, expires_at")
      .eq("id", intentId)
      .maybeSingle();
    if (intentError || !intent) throw new Error(intentError?.message || "Cobrança não encontrada.");

    const reference = `${DONATION_PIX_REFERENCE_PREFIX}${intent.id}`;
    const order = await createPixOrder({
      amount: Number(intent.amount).toFixed(2),
      externalReference: reference,
      payerEmail: auth.user.email,
      idempotencyKey: intent.id,
    });

    const { error: attachError } = await supabase.rpc("attach_donation_provider_order", {
      p_intent_id: intent.id,
      p_provider_order_id: order.id,
      p_provider_reference: reference,
    });
    if (attachError) throw new Error(attachError.message);

    return Response.json({
      ...pixDataFromOrder(order),
      intentId: intent.id,
      amount: Number(intent.amount),
      reservationExpiresAt: intent.expires_at,
      serverNow: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : GENERIC_FAILURE;
    console.error("[doacao-pix-create] Não foi possível criar a cobrança", { campaignId, message });
    const friendly = message.startsWith("O Mercado Pago") ? message : GENERIC_FAILURE;
    return Response.json({ error: friendly }, { status: 503 });
  }
}
