import { createClient } from "@/lib/supabase/server";
import { createPixOrder, getMercadoPagoOrder, pixDataFromOrder } from "@/lib/mercadoPago";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Código padrão do `raise exception` nas funções do banco: é uma regra de
// negócio (vaga cheia, inscrições fechadas...). Qualquer outro erro é técnico
// (banco ocupado, rede) e pode ser repetido sem risco, pois a reserva é reaproveitada.
const BUSINESS_RULE_ERROR = "P0001";
const GENERIC_FAILURE = "Não conseguimos gerar o Pix agora.";

export async function POST(request: Request) {
  let eventId: string | undefined;
  try {
    const body = (await request.json()) as { eventId?: string };
    if (!body.eventId) return Response.json({ error: "Racha inválido.", blocked: true }, { status: 400 });
    eventId = body.eventId;

    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user?.email) return Response.json({ error: "Entre na sua conta novamente.", blocked: true }, { status: 401 });

    const { data: reservation, error: reservationError } = await supabase.rpc("begin_event_payment_reservation", {
      p_event_id: body.eventId,
    });
    if (reservationError) {
      if (reservationError.code !== BUSINESS_RULE_ERROR) throw new Error(reservationError.message);
      // Regra de negócio: a reserva nem chegou a existir, então pagar não
      // resolveria nada. A tela não oferece pagamento (ver PixReservationButton).
      const alreadyPaid = reservationError.message.includes("já está pago");
      return Response.json({ error: reservationError.message, blocked: true, alreadyPaid }, { status: 409 });
    }
    const intent = reservation?.[0];
    if (!intent) throw new Error("A reserva não foi devolvida pelo banco.");

    const { data: storedIntent, error: intentError } = await supabase
      .from("event_payment_intents")
      .select("id, amount, provider_order_id, provider_reference, reservation_expires_at")
      .eq("id", intent.payment_intent_id)
      .maybeSingle();
    if (intentError || !storedIntent) throw new Error(intentError?.message || "Reserva não encontrada.");

    // O Mercado Pago aceita no máximo 64 caracteres aqui; só o id da reserva
    // (que já identifica o racha) cabe com folga.
    const externalReference = storedIntent.provider_reference || `vpa_${storedIntent.id}`;
    const order = storedIntent.provider_order_id
      ? await getMercadoPagoOrder(storedIntent.provider_order_id)
      : await createPixOrder({
          amount: Number(storedIntent.amount).toFixed(2),
          externalReference,
          payerEmail: auth.user.email,
          idempotencyKey: storedIntent.id,
        });

    if (!storedIntent.provider_order_id) {
      const { error: attachError } = await supabase.rpc("attach_event_payment_provider_order", {
        p_intent_id: storedIntent.id,
        p_provider: "mercado_pago",
        p_provider_order_id: order.id,
        p_provider_reference: externalReference,
      });
      if (attachError) {
        // Duas abas ao mesmo tempo: a outra já ligou esta mesma cobrança (a
        // chave de idempotência garante que é a mesma), então está tudo certo.
        const { data: current } = await supabase
          .from("event_payment_intents")
          .select("provider_order_id")
          .eq("id", storedIntent.id)
          .maybeSingle();
        if (current?.provider_order_id !== order.id) throw new Error(attachError.message);
      }
    }

    return Response.json({
      ...pixDataFromOrder(order),
      amount: Number(storedIntent.amount),
      reservationExpiresAt: storedIntent.reservation_expires_at,
      // A contagem usa o relógio do servidor: celular com a hora errada não
      // pode mostrar o prazo errado.
      serverNow: new Date().toISOString(),
      fellBackToRegular: Boolean(intent.fell_back_to_regular),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : GENERIC_FAILURE;
    // Não registra credenciais, QR Code nem dados pessoais. Esta trilha é
    // essencial para diagnosticar uma falha do provedor sem impedir que a
    // pessoa tente gerar a cobrança novamente.
    console.error("[pix-create] Não foi possível criar a cobrança", {
      eventId,
      message,
    });
    // O detalhe técnico fica no log; na tela só as mensagens escritas para o jogador.
    const friendly = message.startsWith("O Mercado Pago") ? message : GENERIC_FAILURE;
    return Response.json({ error: friendly }, { status: 503 });
  }
}
