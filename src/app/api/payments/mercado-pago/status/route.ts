import { createClient } from "@/lib/supabase/server";
import { reconcileEventPayments } from "@/lib/mercadoPagoSettle";

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

    const paid = (await reconcileEventPayments(body.eventId, auth.user.id)) > 0;
    return Response.json({ paid });
  } catch (error) {
    console.error("[pix-status] Falha ao conferir o pagamento", error instanceof Error ? error.message : error);
    return Response.json({ paid: false }, { status: 200 });
  }
}
