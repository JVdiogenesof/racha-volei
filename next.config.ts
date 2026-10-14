import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/camisas/video": ["./src/private-assets/camisas/modelos-vpa.mp4.enc"],
  },
  async headers() {
    // Logos e fotos estáticas mudam raramente: o navegador guarda por 1 dia e
    // revalida em segundo plano, em vez de baixar de novo a cada visita.
    const cache = [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }];
    return [
      { source: "/times/:path*", headers: cache },
    ];
  },
  experimental: {
    serverActions: {
      // Padrão do Next é 1MB, pequeno demais pra foto tirada direto do
      // celular — estourava com "Load failed" ao publicar aviso com imagem.
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
