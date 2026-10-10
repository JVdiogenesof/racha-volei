import { createHmac, timingSafeEqual } from "crypto";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { getMercadoPagoOrder, isApprovedMercadoPagoOrder } from "@/lib/mercadoPago";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function hasValidSignature(request: Request, orderId: string) {
  const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET;
  const signature = request.headers.get("x-signature");
  const requestId = request.headers.get("x-request-id");
  if (!secret || !signature) return false;
  const values = new Map<string, string>();
  for (const part of signature.split(",")) {
    const [key, value] = part.trim().split("=", 2);
    if (key && value) values.set(key, value);
  }
  const timestamp = values.get("ts");
  const supplied = values.get("v1");
  if (!timestamp || !supplied) return false;
  const manifest = `id:${orderId.toLowerCase()};request-id:${requestId ?? ""};ts:${timestamp};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  const suppliedBuffer = Buffer.from(supplied, "hex");
  return expectedBuffer.length === suppliedBuffer.length && timingSafeEqual(expectedBuffer, suppliedBuffer);
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const orderId = url.searchParams.get("data.id");
  if (!orderId || !hasValidSignature(request, orderId)) return new Response(null, { status: 401 });

  try {
    const order = await getMercadoPagoOrder(orderId);
    if (!isApprovedMercadoPagoOrder(order)) return new Response(null, { status: 200 });

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY ausente.");
    const supabase = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: intent, error: intentError } = await supabase
      .from("event_payment_intents")
      .select("id")
      .eq("provider", "mercado_pago")
      .eq("provider_order_id", orderId)
      .maybeSingle();
    if (intentError || !intent) return new Response(null, { status: 200 });

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
    return new Response(null, { status: 200 });
  } catch (error) {
    console.error("Mercado Pago webhook failed", error instanceof Error ? error.message : error);
    return new Response(null, { status: 500 });
  }
}
