import type { Community } from "@/lib/community";

export type ShirtModelInfo = {
  label: string;
  image: string;
  description: string;
};

export const SHIRT_MODELS = {
  tank: {
    label: "Regata",
    image: "/camisas/regata-vpa-v2.webp",
    description: "Leve, esportiva e pronta para a quadra.",
  },
  sleeve: {
    label: "Com manga",
    image: "/camisas/manga-vpa-v2.webp",
    description: "Modelo tradicional com acabamento nas mangas.",
  },
} as const;

export type ShirtModel = keyof typeof SHIRT_MODELS;
export type ShirtExportFilter = "received" | "half" | "paid" | "all";
export function selectShirtExportOrders<T extends { model: ShirtModel; paid: boolean; half_paid: boolean }>(
  orders: T[], model: ShirtModel, filter: ShirtExportFilter,
) {
  return orders.filter((order) => order.model === model && (
    filter === "all" || (filter === "paid" ? order.paid : filter === "half" ? order.half_paid : order.paid || order.half_paid)
  ));
}

export const SHIRT_PRICES: Record<ShirtModel, number> = {
  tank: 37,
  sleeve: 41,
};

export function shirtOrderTotal(order: { model: ShirtModel; quantity: number }) {
  return SHIRT_PRICES[order.model] * order.quantity;
}

export const SHIRT_FITS = { unspecified: "Não informada", regular: "Tradicional", female: "Feminina" } as const;
export type ShirtFit = keyof typeof SHIRT_FITS;
export const SHIRT_ORDER_STATUS_LABELS = {
  awaiting_payment: "Aguardando pagamento",
  ordered: "Pedido feito",
  delivered: "Pedido entregue",
} as const;
export type ShirtOrderStatus = keyof typeof SHIRT_ORDER_STATUS_LABELS;
export function shirtOrderStatusLabel(order: { fulfillment_status: ShirtOrderStatus; paid: boolean; half_paid: boolean }) {
  if (order.fulfillment_status === "awaiting_payment" && (order.paid || order.half_paid)) return "Aguardando pedido à loja";
  return SHIRT_ORDER_STATUS_LABELS[order.fulfillment_status];
}
export type ShirtPayment = "pending" | "half" | "paid" | "mixed";
export type ShirtListView = "all" | "pending" | "partial" | "paid" | "ordered" | "delivered";
export function shirtGroupMatchesView(group: {
  payment: ShirtPayment; items: { fulfillment_status: ShirtOrderStatus }[];
}, view: ShirtListView) {
  if (view === "all") return true;
  if (view === "partial") return group.payment === "half" || group.payment === "mixed";
  if (view === "pending" || view === "paid") return group.payment === view;
  // Deliveries may be partial: show the person with an explicit item count.
  return group.items.some((item) => item.fulfillment_status === view);
}
export const SHIRT_PAYMENT_LABELS: Record<ShirtPayment, string> = {
  pending: "Não pago", half: "Metade paga (50%)", paid: "Pago integralmente", mixed: "Pagamento parcial",
};
export function shirtPayment(order: { paid: boolean; half_paid: boolean }): ShirtPayment {
  return order.paid ? "paid" : order.half_paid ? "half" : "pending";
}
export function groupShirtOrders<T extends { profile_id: string; community: string; paid: boolean; half_paid: boolean }>(orders: T[]) {
  const groups = new Map<string, { profileId: string; community: string; items: T[]; payment: ShirtPayment }>();
  for (const order of orders) {
    const key = order.community + ":" + order.profile_id;
    const group = groups.get(key) ?? { profileId: order.profile_id, community: order.community, items: [], payment: shirtPayment(order) };
    group.items.push(order);
    if (group.payment !== shirtPayment(order)) group.payment = "mixed";
    groups.set(key, group);
  }
  return [...groups.values()];
}

export const SAND_SHIRT_MODELS: Record<ShirtModel, ShirtModelInfo> = {
  tank: {
    label: "Regata",
    image: "/camisas/regata-areia-vpa.webp",
    description: "Modelo roxo leve e ideal para os rachas na areia.",
  },
  sleeve: {
    label: "Com manga",
    image: "/camisas/manga-areia-vpa.webp",
    description: "Modelo roxo tradicional com acabamento nas mangas.",
  },
};

export function getShirtModels(community: Community): Record<ShirtModel, ShirtModelInfo> {
  return community === "sand" ? SAND_SHIRT_MODELS : SHIRT_MODELS;
}

export function getShirtCollectionImage(community: Community) {
  return community === "sand" ? "/camisas/colecao-areia-vpa.webp" : "/camisas/colecao-vpa-v2.webp";
}
export const SHIRT_SIZES = ["PP", "P", "M", "G", "GG"] as const;
export const SLEEVE_SHIRT_SIZES = [...SHIRT_SIZES, "EG"] as const;
export type ShirtSize = (typeof SLEEVE_SHIRT_SIZES)[number];

/** EG é exclusivo da modelagem tradicional da camisa com manga. */
export function getShirtSizes(model: ShirtModel, fit: ShirtFit | "" = ""): readonly ShirtSize[] {
  return model === "sleeve" && fit === "regular" ? SLEEVE_SHIRT_SIZES : SHIRT_SIZES;
}

export function isValidShirtSize(model: ShirtModel, fit: ShirtFit, size: string): size is ShirtSize {
  return getShirtSizes(model, fit).includes(size as ShirtSize);
}

export function formatShirtNumber(value: number) {
  return String(value).padStart(2, "0");
}
