import { Logo } from "@/components/Logo";
import { RegulamentoTabs } from "@/components/RegulamentoTabs";

export const metadata = {
  title: "Regulamento | VPA Racha",
};

export default function RegulamentoPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <Logo className="mb-6" markClassName="h-14 w-14" />

      <h1 className="text-2xl font-bold text-white">Regulamento VPA</h1>
      <p className="mt-1 text-sm text-white/60">
        As regras do nosso racha, resumidas por tópico. Última atualização: outubro de 2026.
      </p>

      <div className="mt-8">
        <RegulamentoTabs />
      </div>
    </div>
  );
}
