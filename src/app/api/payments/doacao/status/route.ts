import { createClient } from "@/lib/supabase/server";
import { reconcileDonationPayments } from "@/lib/donations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Chamado pela tela enquanto o código Pix está aberto: confere direto no Mercado Pago.
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { intentId?: string };
    if (!body.intentId) return Response.json({ error: "Doação inválida." }, { status: 400 });

    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return Response.json({ error: "Entre na sua conta novamente." }, { status: 401 });

    await reconcileDonationPayments(auth.user.id);
    const { data: intent } = await supabase
      .from("donation_intents")
      .select("status")
      .eq("id", body.intentId)
      .eq("profile_id", auth.user.id)
      .maybeSingle();
    return Response.json({ paid: intent?.status === "paid" });
  } catch (error) {
    console.error("[doacao-pix-status] Falha ao conferir o pagamento", error instanceof Error ? error.message : error);
    return Response.json({ paid: false }, { status: 200 });
  }
}
