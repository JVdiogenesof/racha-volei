/** Logos oficiais dos quatro times (arquivos em public/times). Só apresentação. */
export type TeamBrand = { logo: string; logoWeb: string; panel: string; accent: string; glow: string; label: string };

const BRANDS: Record<string, TeamBrand> = {
  refem: { logo: "/times/refem.png", logoWeb: "/times/refem.webp", panel: "#171e25", accent: "#ef4a2f", glow: "rgba(239,74,47,.34)", label: "Refém" },
  magica: { logo: "/times/magica.png", logoWeb: "/times/magica.webp", panel: "#1d2530", accent: "#c084fc", glow: "rgba(168,85,247,.38)", label: "Mágica" },
  "ficha limpa": { logo: "/times/ficha-limpa.png", logoWeb: "/times/ficha-limpa.webp", panel: "#161f2a", accent: "#d4a73a", glow: "rgba(34,150,80,.34)", label: "Ficha Limpa" },
  cobertor: { logo: "/times/cobertor.png", logoWeb: "/times/cobertor.webp", panel: "#1b222a", accent: "#4f8df0", glow: "rgba(59,130,246,.38)", label: "Cobertor" },
};

function normalize(name: string | null | undefined) {
  return (name ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/^time\s+/, "").trim();
}

export function teamBrandFor(name: string | null | undefined): TeamBrand | null {
  return BRANDS[normalize(name)] ?? null;
}

/** Ícone do coração do time (recorte da logo) para listas e confrontos. */
export function teamIconFor(name: string | null | undefined): string | null {
  const brand = teamBrandFor(name);
  return brand ? brand.logo.replace(".png", "-escudo.png") : null;
}

/** Versão leve (WebP) do ícone, para as telas do app. As artes de imagem usam o PNG. */
export function teamIconWebFor(name: string | null | undefined): string | null {
  const brand = teamBrandFor(name);
  return brand ? brand.logoWeb.replace(".webp", "-escudo.webp") : null;
}
