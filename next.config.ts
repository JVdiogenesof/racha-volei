import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Padrão do Next é 1MB, pequeno demais pra foto tirada direto do
      // celular — estourava com "Load failed" ao publicar aviso com imagem.
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
