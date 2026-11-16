import { createClient } from "@/lib/supabase/server";
import { reconcileCupPayments } from "@/lib/copaConfirm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Chamado pela tela enquanto a pessoa está com o código Pix aberto: confere
// o pagamento direto no Mercado Pago e confirma a presença assim que for pago.
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { cupId?: string };
    if (!body.cupId) return Response.json({ error: "Copa inválida." }, { status: 400 });

    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return Response.json({ error: "Entre na sua conta novamente." }, { status: 401 });

    await reconcileCupPayments(body.cupId, auth.user.id);

    const [{ data: confirmation }, { data: latestIntent }] = await Promise.all([
      supabase.from("cup_confirmations").select("status").eq("cup_id", body.cupId).eq("profile_id", auth.user.id).maybeSingle(),
      supabase
        .from("cup_payment_intents")
        .select("status")
        .eq("cup_id", body.cupId)
        .eq("profile_id", auth.user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    const paid = confirmation?.status === "confirmed" || latestIntent?.status === "paid";
    // Pagou, mas fora do prazo / sem vaga: a organização devolve o valor.
    return Response.json({ paid, credited: latestIntent?.status === "refund_needed" });
  } catch (error) {
    console.error("[copa-pix-status] Falha ao conferir o pagamento", error instanceof Error ? error.message : error);
    return Response.json({ paid: false, credited: false }, { status: 200 });
  }
}
