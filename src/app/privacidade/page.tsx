import { Logo } from "@/components/Logo";

export const metadata = {
  title: "Política de Privacidade | VPA Racha",
};

export default function PrivacidadePage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <Logo className="mb-8" markClassName="h-12 w-12" />

      <h1 className="text-2xl font-bold text-white">Política de Privacidade</h1>
      <p className="mt-1 text-sm text-white/60">Última atualização: setembro de 2026</p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-white/80">
        <p>
          O VPA Racha é um site de uso interno do grupo &quot;Vôlei Por Amor
          Racha&quot; para organizar presença, times e avisos dos rachas de
          vôlei. Esta página explica quais dados coletamos e como usamos.
        </p>

        <section>
          <h2 className="font-semibold text-white">Quais dados coletamos</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Nome, foto de perfil e e-mail da sua conta Google, usados apenas para login.</li>
            <li>Dados de cadastro que você preenche: aniversário, telefone e se joga de levantador.</li>
            <li>Suas autoavaliações de habilidade no vôlei.</li>
            <li>Confirmações e interesse de presença nos rachas.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-white">Como usamos esses dados</h2>
          <p className="mt-2">
            Os dados são usados exclusivamente para organizar os rachas do
            grupo: gerar times balanceados, controlar presença e pagamentos, e
            exibir avisos e resultados de MVP aos membros aprovados do grupo.
            Não vendemos nem compartilhamos seus dados com terceiros.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-white">Quem pode ver seus dados</h2>
          <p className="mt-2">
            Nome, foto e notas de habilidade ficam visíveis para os demais
            membros aprovados do grupo, para dar transparência às avaliações.
            Apenas os organizadores podem aprovar novos membros e ajustar
            notas.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-white">Exclusão de dados</h2>
          <p className="mt-2">
            Você pode pedir a remoção da sua conta e dos seus dados a
            qualquer momento, falando diretamente com um dos organizadores do
            grupo.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-white">Contato</h2>
          <p className="mt-2">
            Dúvidas sobre esta política podem ser enviadas para{" "}
            <a
              href="mailto:joaovictoralmeidadiogenes@gmail.com"
              className="text-purple-300 underline"
            >
              joaovictoralmeidadiogenes@gmail.com
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
