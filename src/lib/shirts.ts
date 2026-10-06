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

export const SHIRT_PRICES: Record<ShirtModel, number> = {
  tank: 37,
  sleeve: 41,
};

export function shirtOrderTotal(order: { model: ShirtModel; quantity: number }) {
  return SHIRT_PRICES[order.model] * order.quantity;
}

export const SHIRT_FITS = { unspecified: "Não informada", regular: "Tradicional", female: "Feminina" } as const;
export type ShirtFit = keyof typeof SHIRT_FITS;
export type ShirtPayment = "pending" | "half" | "paid" | "mixed";
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
export type ShirtSize = (typeof SHIRT_SIZES)[number];

export function formatShirtNumber(value: number) {
  return String(value).padStart(2, "0");
}
