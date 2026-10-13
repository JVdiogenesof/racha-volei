import { createClient } from "@/lib/supabase/server";
import { settleMercadoPagoOrder } from "@/lib/mercadoPagoSettle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Chamado pela tela enquanto a pessoa está com o código Pix aberto: confere
// o pagamento direto no Mercado Pago e confirma a vaga assim que for pago.
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { eventId?: string };
    if (!body.eventId) return Response.json({ error: "Racha inválido." }, { status: 400 });

    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return Response.json({ error: "Entre na sua conta novamente." }, { status: 401 });

    // Só pedidos da própria pessoa (a RLS já limita as reservas dela).
    const { data: intents } = await supabase
      .from("event_payment_intents")
      .select("provider_order_id, status")
      .eq("event_id", body.eventId)
      .eq("profile_id", auth.user.id)
      .in("status", ["pending", "expired"])
      .not("provider_order_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(3);

    let paid = false;
    for (const intent of intents ?? []) {
      if (!intent.provider_order_id) continue;
      if ((await settleMercadoPagoOrder(intent.provider_order_id)) === "paid") {
        paid = true;
        break;
      }
    }
    return Response.json({ paid });
  } catch (error) {
    console.error("[pix-status] Falha ao conferir o pagamento", error instanceof Error ? error.message : error);
    return Response.json({ paid: false }, { status: 200 });
  }
}
