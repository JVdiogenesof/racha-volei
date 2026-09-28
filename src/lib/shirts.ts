export const SHIRT_MODELS = {
  tank: {
    label: "Regata",
    image: "/camisas/regata-vpa.jpg",
    description: "Leve, esportiva e pronta para a quadra.",
  },
  sleeve: {
    label: "Com manga",
    image: "/camisas/manga-vpa.jpg",
    description: "Modelo tradicional com acabamento nas mangas.",
  },
} as const;

export type ShirtModel = keyof typeof SHIRT_MODELS;
export const SHIRT_SIZES = ["PP", "P", "M", "G", "GG"] as const;
export type ShirtSize = (typeof SHIRT_SIZES)[number];

export function formatShirtNumber(value: number) {
  return String(value).padStart(2, "0");
}
