import { Check } from "lucide-react";

export type JoinMode = "pix" | "manual" | "free";
export type JoinStatus = "confirmed" | "interested" | "declined" | "none";

/** Como a pessoa entra na lista: Pix automático, Pix na chave (organização confirma) ou sem pagamento. */
export function joinMode({ price, pixAuto, exempt }: { price: number | null; pixAuto: boolean; exempt: boolean }): JoinMode {
  if (!price || exempt) return "free";
  return pixAuto ? "pix" : "manual";
}

const STEP_TEXT: Record<JoinMode, string[]> = {
  pix: ["Toque em Quero jogar", "Pague o Pix pelo app (copia e cola)", "Pronto: seu nome entra na lista sozinho"],
  manual: ["Toque em Quero jogar", "Pague o Pix na chave informada", "A organização confirma seu nome na lista"],
  free: ["Toque em Quero jogar", "A organização confirma seu nome na lista"],
};

const SHORT_LABEL: Record<JoinMode, string[]> = {
  pix: ["Quero jogar", "Pagar Pix", "Na lista"],
  manual: ["Quero jogar", "Pagar Pix", "Na lista"],
  free: ["Quero jogar", "Na lista"],
};

/** Passo atual (1 = primeiro). Um número acima do total significa que já está na lista. */
export function currentJoinStep({ mode, status, paid }: { mode: JoinMode; status: JoinStatus; paid: boolean }) {
  const total = STEP_TEXT[mode].length;
  // Confirmado sem pagar (vaga garantida pela organização): ainda falta o pagamento.
  if (status === "confirmed") return mode !== "free" && !paid ? 2 : total + 1;
  if (status === "interested") return mode === "free" ? 2 : paid ? 3 : 2;
  return 1;
}

function nextAction({ mode, step, isFull, status }: { mode: JoinMode; step: number; isFull: boolean; status: JoinStatus }) {
  const total = STEP_TEXT[mode].length;
  if (status === "confirmed" && step <= total) {
    return mode === "pix"
      ? "Sua vaga está reservada, mas falta pagar o Pix pelo app."
      : "Sua vaga está reservada, mas falta pagar o Pix na chave informada.";
  }
  if (step > total) return "Você está na lista de confirmados.";
  if (step === 1) {
    if (isFull) return "A lista está cheia. Toque em Quero jogar para entrar na fila de espera: você só é chamado(a) se alguém desistir. Não pague nada agora.";
    return mode === "free"
      ? "Toque em Quero jogar para pedir sua vaga."
      : "Toque em Quero jogar. Só marcar não garante a vaga: o Pix vem logo depois.";
  }
  if (mode === "pix") return "Falta pagar o Pix pelo app. A vaga só é sua depois do pagamento.";
  if (mode === "manual") return step === 2 ? "Falta pagar o Pix na chave informada. A vaga só é sua depois do pagamento." : "Pagamento feito. A organização vai confirmar seu nome.";
  return "Pedido enviado. A organização confirma seu nome na lista.";
}

/** Passo a passo de como entrar na lista, com o passo atual destacado. */
export function RachaHowToJoin({
  mode,
  status,
  paid,
  isFull = false,
  variant = "full",
}: {
  mode: JoinMode;
  status: JoinStatus;
  paid: boolean;
  isFull?: boolean;
  variant?: "full" | "compact";
}) {
  const step = currentJoinStep({ mode, status, paid });
  const sentence = nextAction({ mode, step, isFull, status });

  if (variant === "compact") {
    const labels = SHORT_LABEL[mode];
    return (
      <div className="rounded-xl border border-white/15 bg-black/25 p-2.5" aria-label="Como entrar na lista">
        <ol className="flex items-center gap-1">
          {labels.map((label, index) => {
            const number = index + 1;
            const done = step > number;
            const active = step === number;
            return (
              <li key={label} className="flex min-w-0 flex-1 items-center gap-1">
                <span
                  className={`flex min-w-0 flex-1 items-center justify-center gap-1 rounded-lg px-1.5 py-1.5 text-[11px] font-bold leading-tight ${
                    done ? "bg-emerald-400/20 text-emerald-100" : active ? "bg-white text-[#4c1d95]" : "bg-white/10 text-white/55"
                  }`}
                >
                  <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-black ${done ? "bg-emerald-400 text-emerald-950" : active ? "bg-[#4c1d95] text-white" : "bg-white/15"}`}>
                    {done ? <Check className="h-3 w-3" strokeWidth={3.5} /> : number}
                  </span>
                  <span className="break-words text-center">{label}</span>
                </span>
              </li>
            );
          })}
        </ol>
        <p className="mt-2 break-words text-xs font-medium leading-snug text-white/85">{sentence}</p>
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-3.5" aria-label="Como entrar na lista">
      <h2 className="text-sm font-black text-white">Como entrar na lista</h2>
      <ol className="mt-2.5 space-y-2">
        {STEP_TEXT[mode].map((text, index) => {
          const number = index + 1;
          const done = step > number;
          const active = step === number;
          return (
            <li key={text} className="flex items-start gap-2.5">
              <span
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                  done ? "bg-emerald-400 text-emerald-950" : active ? "bg-brand-purple text-white ring-4 ring-purple-400/20" : "bg-white/10 text-white/50"
                }`}
              >
                {done ? <Check className="h-3.5 w-3.5" strokeWidth={3.5} /> : number}
              </span>
              <span className={`min-w-0 break-words text-sm leading-snug ${active ? "font-bold text-white" : done ? "text-emerald-100/90" : "text-white/55"}`}>{text}</span>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 break-words rounded-xl bg-black/20 px-3 py-2 text-xs font-medium leading-relaxed text-white/80">{sentence}</p>
    </section>
  );
}
