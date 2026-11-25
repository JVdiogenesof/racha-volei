"use client";

import { useState } from "react";
import { CalendarDays, Wallet, ShieldAlert, Gauge, Trophy, type LucideIcon } from "lucide-react";

type Topic = {
  id: string;
  label: string;
  icon: LucideIcon;
  items: { title: string; points: string[] }[];
};

const TOPICS: Topic[] = [
  {
    id: "lista",
    label: "Lista e vagas",
    icon: CalendarDays,
    items: [
      {
        title: "Abertura das listas",
        points: [
          "Racha de sábado: a lista abre na quarta-feira, às 20h, em lote único.",
          "Racha de domingo: a lista abre em dois lotes. Quinta-feira, às 20h, com 16 vagas. Sexta-feira, às 12h, com 8 vagas. O que sobrar do primeiro lote passa para o segundo.",
          "Os horários são os definidos pela organização em cada racha, sempre avisados antes.",
          "A confirmação é automática: marcou interesse, pagou o Pix, a vaga é sua.",
        ],
      },
      {
        title: "Vagas especiais",
        points: [
          "Levantador, novato e vaga garantida estão incluídos no total de vagas do racha.",
          "Levantador tem cota própria (1 a cada 6 vagas), separada da vaga comum.",
          "Novatos têm cota reservada quando a organização define. Dentro dela pode haver 1 ou 2 vagas de levantador novato: elas contam dentro das vagas de novato, então o total do grupo não muda.",
          "A organização pode garantir uma vaga antes da lista abrir. A pessoa conclui o Pix depois, sem disputar vaga.",
        ],
      },
      {
        title: "Lista cheia e desistências",
        points: [
          "Com a lista cheia, quem marca interesse entra na lista de espera, por ordem de chegada.",
          "Quando uma vaga abre, a próxima pessoa é chamada automaticamente e tem 1 hora para aceitar. Em racha pago, aceitar significa pagar o Pix.",
          "Sem resposta no prazo, ou se recusar, a vaga passa para a próxima pessoa.",
          "As vagas são pessoais. Passar a vaga para outra pessoa só vale com a aprovação de um organizador, que faz a transferência no app.",
        ],
      },
    ],
  },
  {
    id: "pagamento",
    label: "Pagamento",
    icon: Wallet,
    items: [
      {
        title: "Pagamento por Pix",
        points: [
          "Todo pagamento é feito por Pix, pelo próprio site, sem precisar de aprovação de ninguém.",
          "A vaga fica reservada por 5 minutos para você concluir o pagamento. Assim que o Pix cai, a vaga é confirmada.",
        ],
      },
      {
        title: "Desistência dentro do prazo",
        points: [
          "Racha de sábado: até sábado, às 10h. Racha de domingo: até sábado, às 20h.",
          "Dentro do prazo você escolhe entre ficar com o valor como saldo para outro racha ou pedir reembolso. O reembolso sai em até 48 horas.",
        ],
      },
      {
        title: "Desistência fora do prazo",
        points: [
          "Passado o prazo, não há saldo nem reembolso: o valor vai para o caixa do VPA, mesmo que outra pessoa ocupe a vaga.",
          "O caixa é usado em atividades, materiais, premiações, eventos e demais necessidades do VPA.",
        ],
      },
    ],
  },
  {
    id: "conduta",
    label: "Presença e conduta",
    icon: ShieldAlert,
    items: [
      {
        title: "Ausências",
        points: [
          "A contagem é por fim de semana: sábado e domingo juntos valem uma vez. Ir a qualquer racha do fim de semana interrompe a contagem.",
          "Com 4 fins de semana seguidos sem participar, você recebe um aviso automático. Com 6 seguidos, o acesso ao grupo e ao app é removido.",
          "Ficar na lista de espera sem chance de jogar não conta como ausência.",
          "A contagem recomeça do zero assim que você participa de um racha.",
        ],
      },
      {
        title: "Remoção e retorno",
        points: [
          "A remoção por ausência é organizacional, não é punição. Quem sai pode pedir retorno pela lista de reserva, nos mesmos critérios de quem entra pela primeira vez.",
          "Quem é removido(a) tem a pontuação do Índice zerada e perde a vaga já garantida no Torneio Oficial, que é redistribuída pelo ranking.",
          "Não há vaga garantida nem recuperação da pontuação anterior.",
        ],
      },
      {
        title: "Compromisso com a vaga",
        points: [
          "Atraso de mais de 30 minutos reduz em 50% a presença daquele racha. Justificativas são avaliadas pela administração.",
          "Falta sem justificativa depois de confirmar a vaga pode gerar impedimento de participar nos dois fins de semana seguintes.",
          "Saída antes do fim do racha é avaliada caso a caso.",
          "Impedimentos de força maior devem ser avisados a um organizador e são avaliados fora da contagem automática.",
        ],
      },
      {
        title: "Convivência e uniforme",
        points: [
          "Respeito, diversão e boa convivência valem para todos. Comportamento que fere isso pode gerar advertência ou remoção, independente da contagem de ausências.",
          "Dúvidas técnicas, como notas e formação de times, são tratadas direto com a administração.",
          "O uniforme oficial é recomendado nos rachas e obrigatório no Torneio Oficial.",
        ],
      },
      {
        title: "Times e notas",
        points: [
          "As equipes são formadas pelo aplicativo e a administração pode ajustá-las antes e durante o racha.",
          "As notas são confidenciais, exclusivas da administração, e servem só para equilibrar as equipes.",
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
          "Nota viva dos últimos 8 rachas — os 4 mais recentes pesam 2,5 vezes mais que os anteriores.",
          "40% saldo de pontos + 30% aproveitamento + 30% presença, mais o bônus de evolução.",
          "Saldo de pontos: margem média dos seus jogos com placar, entre pontos feitos e sofridos. Aproveitamento: percentual de vitórias. Presença: quanto você esteve nos rachas da janela.",
          "Com poucos jogos, aproveitamento e saldo ficam mais perto de 50, para uma boa sequência curta não valer como campanha sólida.",
          "Bônus de evolução de até 10 pontos para quem voltou a jogar e melhorou o aproveitamento dos 4 rachas mais recentes em relação aos anteriores.",
          "É preciso ao menos 2 participações para aparecer no ranking.",
        ],
      },
      {
        title: "O que conta pontos",
        points: [
          "Todo racha conta para o Índice e para os demais rankings, inclusive os de sábado, com 3 ou 4 times. Pré-torneios e copas também pontuam.",
          "A organização escolhe, racha a racha, se ele conta para o ranking (por exemplo, um racha de teste ou especial pode ficar de fora) e avisa antes.",
          "A seleção do mês segue a mesma lógica e conta todos os rachas do mês.",
        ],
      },
      {
        title: "Desempate",
        points: ["Em empate no Índice, vale o saldo de pontos, depois o aproveitamento, depois a presença."],
      },
      {
        title: "Quando começa",
        points: [
          "Os pesos novos e a contagem dos sábados valem a partir do primeiro racha de dezembro de 2026.",
          "Ninguém é zerado e não nasce um índice novo. Os rachas anteriores continuam como foram registrados.",
        ],
      },
    ],
  },
  {
    id: "torneios",
    label: "Torneios",
    icon: Trophy,
    items: [
      {
        title: "Torneio Oficial",
        points: [
          "As 24 primeiras posições do Índice garantem vaga. Top 10 em verde, 11º ao 24º em azul, o resto fora da zona.",
          "O time campeão do pré-torneio garante vaga direta, sem depender do Índice.",
          "Quem não confirma dentro do prazo perde a vaga, que é redistribuída pelo ranking.",
        ],
      },
      {
        title: "Pré-torneio",
        points: [
          "Fase de grupos + final decide o time campeão.",
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
