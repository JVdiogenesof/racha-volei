import { createHmac, timingSafeEqual } from "crypto";
import { settleMercadoPagoOrder } from "@/lib/mercadoPagoSettle";

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
  // O Mercado Pago pede que campos ausentes sejam omitidos do manifesto, em
  // vez de assinados como string vazia. Assim a confirmação continua válida
  // mesmo numa tentativa de webhook sem x-request-id.
  const manifest = [
    `id:${orderId.toLowerCase()};`,
    ...(requestId ? [`request-id:${requestId};`] : []),
    `ts:${timestamp};`,
  ].join("");
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
    await settleMercadoPagoOrder(orderId);
    return new Response(null, { status: 200 });
  } catch (error) {
    console.error("Mercado Pago webhook failed", error instanceof Error ? error.message : error);
    return new Response(null, { status: 500 });
  }
}
