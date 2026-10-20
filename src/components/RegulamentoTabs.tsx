"use client";

import { useState } from "react";
import { CalendarDays, Wallet, Users2, ShieldAlert, Gauge, Trophy, type LucideIcon } from "lucide-react";

type Topic = {
  id: string;
  label: string;
  icon: LucideIcon;
  items: { title: string; points: string[] }[];
};

const TOPICS: Topic[] = [
  {
    id: "lista",
    label: "Lista",
    icon: CalendarDays,
    items: [
      {
        title: "Abertura",
        points: [
          "A lista de interesse abre toda quinta, às 20h.",
          "Ao marcar interesse, você já paga a vaga por Pix na hora — a confirmação é automática, sem aprovação manual.",
        ],
      },
      {
        title: "Lista cheia",
        points: [
          "Ainda dá pra marcar interesse — você entra na lista de espera, em ordem de quem marcou primeiro.",
        ],
      },
      {
        title: "Vaga aberta por desistência",
        points: [
          "A próxima pessoa da lista de espera é chamada automaticamente e tem 1 hora pra aceitar.",
          "Sem resposta no prazo, ou se recusar, ela sai da lista e a vaga passa pra próxima pessoa.",
          "Em racha pago, \"aceitar\" significa pagar — a vaga só é garantida depois do Pix confirmado.",
        ],
      },
    ],
  },
  {
    id: "vagas",
    label: "Vagas especiais",
    icon: Users2,
    items: [
      { title: "Levantador", points: ["Tem cota própria, separada da vaga comum."] },
      { title: "Convidado / novato", points: ["Cota reservada própria, quando definida pelo organizador."] },
      {
        title: "Vaga garantida",
        points: ["O organizador pode reservar uma vaga pra alguém antes da lista abrir; a pessoa conclui o pagamento por Pix depois, sem disputar vaga com ninguém."],
      },
    ],
  },
  {
    id: "pagamento",
    label: "Pagamento",
    icon: Wallet,
    items: [
      {
        title: "Pagamento 100% automático por Pix",
        points: [
          "Ao marcar interesse, você gera o Pix na hora e paga direto pelo site — sem precisar de ninguém aprovar.",
          "A vaga fica reservada por 5 minutos pra você concluir o pagamento.",
          "Assim que o Pix cai, sua vaga é confirmada automaticamente.",
        ],
      },
      {
        title: "Prazo pra desistir",
        points: [
          "Até sábado, 20h: você escolhe entre virar saldo pra outro racha ou pedir reembolso.",
          "Depois de sábado 20h: a desistência sempre vira saldo — nunca mais reembolso, e nunca fica retida.",
        ],
      },
      { title: "Troca de vaga", points: ["Quem já pagou pode transferir a vaga direto pra uma pessoa específica da lista de interessados."] },
    ],
  },
  {
    id: "conduta",
    label: "Conduta",
    icon: ShieldAlert,
    items: [
      {
        title: "Participação e ausências",
        points: [
          "Depois de 4 rachas finalizados seguidos sem participar, você recebe um aviso automático.",
          "Depois de 6 seguidos, o acesso ao grupo e ao app é removido automaticamente.",
          "A contagem reseta assim que você participa de um racha de novo.",
        ],
      },
      {
        title: "O que acontece ao ser removido(a)",
        points: [
          "Sua pontuação no Índice VPA zera e some do ranking.",
          "Vaga já garantida pro Torneio Oficial (por índice ou pré-torneio) é perdida e redistribuída pelos critérios do ranking.",
        ],
      },
      {
        title: "Retorno ao grupo",
        points: [
          "Dá pra pedir retorno pela lista de reserva, nos mesmos critérios de quem está entrando pela primeira vez.",
          "Não há vaga garantida nem recuperação da pontuação anterior.",
        ],
      },
      {
        title: "Situações excepcionais",
        points: [
          "Impedimentos de força maior devem ser avisados diretamente a um organizador -- casos assim são avaliados fora da contagem automática.",
          "Comportamento que comprometa o respeito e a convivência do grupo pode gerar advertência ou remoção, independente da contagem de faltas.",
        ],
      },
      {
        title: "Uniforme oficial",
        points: [
          "Recomendado nas atividades normais, pra fortalecer a identidade do VPA e valorizar os patrocinadores.",
          "Obrigatório no Torneio Oficial.",
        ],
      },
    ],
  },
  {
    id: "indice",
    label: "Índice VPA",
    icon: Gauge,
    items: [
      {
        title: "Como é calculado",
        points: [
          "Nota viva dos últimos 8 rachas — os 4 mais recentes pesam mais que os antigos.",
          "65% aproveitamento (vitórias) + 35% presença, com bônus por evolução recente.",
          "Precisa de pelo menos 2 rachas jogados pra entrar na classificação.",
        ],
      },
      {
        title: "Classificação pro Torneio Oficial",
        points: [
          "As 24 primeiras posições garantem vaga.",
          "Top 10 aparece em verde, 11º–24º em azul, o resto em vermelho (fora da zona).",
        ],
      },
    ],
  },
  {
    id: "pretorneio",
    label: "Pré-torneio",
    icon: Trophy,
    items: [
      {
        title: "Formato",
        points: ["Fase de grupos + final decide o time campeão do pré-torneio."],
      },
      {
        title: "Classificação",
        points: [
          "O time campeão garante vaga direto no Torneio Oficial, sem depender da nota do Índice.",
          "Todo mundo já classificado (por nota ou por pré-torneio) aparece em Torneios VPA.",
        ],
      },
    ],
  },
];

export function RegulamentoTabs() {
  const [active, setActive] = useState(TOPICS[0].id);
  const activeTopic = TOPICS.find((t) => t.id === active)!;

  return (
    <div>
      <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-white/10 bg-white/[0.03] p-1.5 sm:grid-cols-3">
        {TOPICS.map((topic) => {
          const Icon = topic.icon;
          const selected = topic.id === active;
          return (
            <button
              key={topic.id}
              type="button"
              onClick={() => setActive(topic.id)}
              aria-pressed={selected}
              className={`flex min-h-9 min-w-0 items-center justify-center gap-1.5 rounded-xl px-2 py-1.5 text-xs font-semibold leading-tight transition ${
                selected ? "bg-brand-purple text-white shadow-md shadow-purple-950/30" : "text-white/45 hover:bg-white/5 hover:text-white/75"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" strokeWidth={2.25} />
              <span className="min-w-0 truncate">{topic.label}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 space-y-4">
        {activeTopic.items.map((item) => (
          <section key={item.title} className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
            <h2 className="text-sm font-bold text-white">{item.title}</h2>
            <ul className="mt-2 space-y-1.5">
              {item.points.map((point) => (
                <li key={point} className="flex gap-2 text-sm leading-relaxed text-white/70">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-purple-300" />
                  {point}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
