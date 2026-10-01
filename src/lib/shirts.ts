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
