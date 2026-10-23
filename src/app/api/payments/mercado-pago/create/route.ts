import { createClient } from "@/lib/supabase/server";
import { createPixOrder, getMercadoPagoOrder, pixDataFromOrder } from "@/lib/mercadoPago";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let eventId: string | undefined;
  try {
    const body = (await request.json()) as { eventId?: string };
    if (!body.eventId) return Response.json({ error: "Racha inválido." }, { status: 400 });
    eventId = body.eventId;

    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user?.email) return Response.json({ error: "Entre na sua conta novamente." }, { status: 401 });

    const { data: reservation, error: reservationError } = await supabase.rpc("begin_event_payment_reservation", {
      p_event_id: body.eventId,
    });
    // Erro aqui (vaga/vaga de levantador/novato cheia, inscrições fechadas
    // etc.) significa que a reserva nem chegou a existir -- pagar não
    // resolveria nada, então marca como "blocked" pra tela não oferecer a
    // chave Pix manual como se fosse só uma falha técnica (ver PixReservationButton).
    if (reservationError) return Response.json({ error: reservationError.message, blocked: true }, { status: 409 });
    const intent = reservation?.[0];
    if (!intent) return Response.json({ error: "Não foi possível reservar sua vaga.", blocked: true }, { status: 409 });

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
      if (attachError) throw new Error(attachError.message);
    }

    return Response.json({
      ...pixDataFromOrder(order),
      reservationExpiresAt: storedIntent.reservation_expires_at,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível iniciar o pagamento Pix.";
    // Não registra credenciais, QR Code nem dados pessoais. Esta trilha é
    // essencial para diagnosticar uma falha do provedor sem impedir que a
    // pessoa tente gerar a cobrança novamente.
    console.error("[pix-create] Não foi possível criar a cobrança", {
      eventId,
      message,
    });
    return Response.json({ error: message }, { status: 400 });
  }
}
