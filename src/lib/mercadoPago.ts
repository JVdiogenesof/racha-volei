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

type MercadoPagoErrorBody = {
  message?: string;
  error?: string;
  errors?: Array<{
    code?: string;
    message?: string;
    details?: string | string[];
  }>;
};

function accessToken() {
  const token = process.env.MERCADO_PAGO_ACCESS_TOKEN;
  if (!token) throw new Error("Os pagamentos Pix ainda não foram configurados.");
  return token;
}

// Só 1 segunda tentativa, e só quando o provedor claramente não respondeu de
// verdade (timeout, erro de rede, ou 5xx) -- um 4xx é uma rejeição de
// validação, repetir não muda o resultado.
const REQUEST_TIMEOUT_MS = 12_000;
const RETRY_DELAY_MS = 500;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(path: string, init: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(`https://api.mercadopago.com${path}`, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function mercadoPagoRequest(path: string, init: RequestInit) {
  const requestInit: RequestInit = {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken()}`,
      ...init.headers,
    },
    cache: "no-store",
  };

  let response: Response;
  try {
    response = await fetchWithTimeout(path, requestInit);
  } catch (networkError) {
    // Falha de rede/timeout na primeira tentativa: espera um instante e
    // tenta mais uma vez antes de desistir -- cobre uma instabilidade curta
    // do provedor sem fazer a pessoa clicar de novo.
    console.error("[mercado-pago] Falha de rede, tentando de novo", { path, message: (networkError as Error).message });
    await sleep(RETRY_DELAY_MS);
    try {
      response = await fetchWithTimeout(path, requestInit);
    } catch (retryError) {
      console.error("[mercado-pago] Falha de rede na segunda tentativa", { path, message: (retryError as Error).message });
      throw new Error("O Mercado Pago não respondeu a tempo. Tente novamente em alguns instantes.");
    }
  }

  if (response.status >= 500) {
    console.error("[mercado-pago] Resposta 5xx do provedor, tentando de novo", { path, status: response.status });
    await sleep(RETRY_DELAY_MS);
    try {
      response = await fetchWithTimeout(path, requestInit);
    } catch {
      throw new Error("O Mercado Pago está instável agora. Tente novamente em alguns instantes.");
    }
  }

  const body = (await response.json().catch(() => null)) as MercadoPagoOrder | MercadoPagoErrorBody | null;
  if (!response.ok) {
    const errorBody = body as MercadoPagoErrorBody | null;
    const providerError = errorBody?.errors?.[0];
    const details = Array.isArray(providerError?.details) ? providerError.details.join(", ") : providerError?.details;
    const base = providerError?.message || details || errorBody?.message || errorBody?.error;
    // O Mercado Pago costuma dizer só "Invalid value for property"; o campo
    // problemático vem em details, então vai junto na mensagem.
    const message = base && details && base !== details ? `${base} (${details})` : base;
    console.error("[mercado-pago] Requisição recusada pelo provedor", {
      path,
      status: response.status,
      code: providerError?.code,
      message: message || "Resposta sem mensagem",
    });
    if (response.status >= 500) {
      throw new Error("O Mercado Pago está instável agora. Tente novamente em alguns instantes.");
    }
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
