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

    await reconcileEventPayments(body.eventId, auth.user.id);

    // Olha o resultado salvo, e não só o que esta chamada conferiu: o aviso
    // (webhook) do Mercado Pago pode ter confirmado a vaga um instante antes.
    const [{ data: payment }, { data: latestIntent }] = await Promise.all([
      supabase.from("payments").select("paid").eq("event_id", body.eventId).eq("profile_id", auth.user.id).maybeSingle(),
      supabase
        .from("event_payment_intents")
        .select("status")
        .eq("event_id", body.eventId)
        .eq("profile_id", auth.user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    return Response.json({ paid: Boolean(payment?.paid), credited: latestIntent?.status === "credited" });
  } catch (error) {
    console.error("[pix-status] Falha ao conferir o pagamento", error instanceof Error ? error.message : error);
    return Response.json({ paid: false, credited: false }, { status: 200 });
  }
}
