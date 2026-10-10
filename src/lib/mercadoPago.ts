import "server-only";

type MercadoPagoPayment = {
  id?: string;
  status?: string;
  status_detail?: string;
  payment_method?: {
    ticket_url?: string;
    qr_code?: string;
    qr_code_base64?: string;
  };
};

export type MercadoPagoOrder = {
  id: string;
  external_reference?: string;
  status?: string;
  status_detail?: string;
  transactions?: { payments?: MercadoPagoPayment[] };
};

function accessToken() {
  const token = process.env.MERCADO_PAGO_ACCESS_TOKEN;
  if (!token) throw new Error("Os pagamentos Pix ainda não foram configurados.");
  return token;
}

async function mercadoPagoRequest(path: string, init: RequestInit) {
  const response = await fetch(`https://api.mercadopago.com${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken()}`,
      ...init.headers,
    },
    cache: "no-store",
  });
  const body = (await response.json().catch(() => null)) as MercadoPagoOrder | { message?: string; error?: string } | null;
  if (!response.ok) {
    const message = body && "message" in body ? body.message : body && "error" in body ? body.error : null;
    throw new Error(message || "Não foi possível gerar a cobrança Pix.");
  }
  return body as MercadoPagoOrder;
}

export async function createPixOrder(input: {
  amount: string;
  externalReference: string;
  payerEmail: string;
  idempotencyKey: string;
}) {
  return mercadoPagoRequest("/v1/orders", {
    method: "POST",
    headers: { "X-Idempotency-Key": input.idempotencyKey },
    body: JSON.stringify({
      type: "online",
      total_amount: input.amount,
      external_reference: input.externalReference,
      processing_mode: "automatic",
      transactions: {
        payments: [
          {
            amount: input.amount,
            payment_method: { id: "pix", type: "bank_transfer" },
            // O Mercado Pago exige pelo menos 30 minutos. A vaga no VPA segue
            // com expiração própria de 5 minutos.
            expiration_time: "PT30M",
          },
        ],
      },
      payer: { email: input.payerEmail },
    }),
  });
}

export async function getMercadoPagoOrder(orderId: string) {
  return mercadoPagoRequest(`/v1/orders/${encodeURIComponent(orderId)}`, { method: "GET" });
}

export function pixDataFromOrder(order: MercadoPagoOrder) {
  const payment = order.transactions?.payments?.[0];
  const method = payment?.payment_method;
  if (!method?.qr_code || !method.qr_code_base64 || !method.ticket_url) {
    throw new Error("O Mercado Pago não retornou os dados do Pix.");
  }
  return {
    qrCode: method.qr_code,
    qrCodeBase64: method.qr_code_base64,
    ticketUrl: method.ticket_url,
    status: payment?.status ?? order.status ?? "pending",
  };
}

export function isApprovedMercadoPagoOrder(order: MercadoPagoOrder) {
  const payment = order.transactions?.payments?.[0];
  return order.status === "processed" || payment?.status === "processed" || payment?.status_detail === "accredited";
}
