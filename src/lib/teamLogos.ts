/** Logos oficiais dos quatro times (arquivos em public/times). Só apresentação. */
export type TeamBrand = { logo: string; panel: string; accent: string; glow: string; label: string };

const BRANDS: Record<string, TeamBrand> = {
  refem: { logo: "/times/refem.png", panel: "#171e25", accent: "#ef4a2f", glow: "rgba(239,74,47,.34)", label: "Refém" },
  magica: { logo: "/times/magica.png", panel: "#1d2530", accent: "#c084fc", glow: "rgba(168,85,247,.38)", label: "Mágica" },
  "ficha limpa": { logo: "/times/ficha-limpa.png", panel: "#161f2a", accent: "#d4a73a", glow: "rgba(34,150,80,.34)", label: "Ficha Limpa" },
  cobertor: { logo: "/times/cobertor.png", panel: "#1b222a", accent: "#4f8df0", glow: "rgba(59,130,246,.38)", label: "Cobertor" },
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
