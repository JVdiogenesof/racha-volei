import Link from "next/link";
import { ArrowRight, CheckCircle2, CreditCard, ThumbsUp, Users, type LucideIcon } from "lucide-react";

type Step = { icon: LucideIcon; label: string; done: boolean };

/** Etapas do jogador no racha: interesse, pagamento (quando existe) e entrada na lista. */
export function RachaSteps({
  interestDone,
  paymentDone,
  listDone,
  needsPayment,
  pix,
}: {
  interestDone: boolean;
  paymentDone: boolean;
  listDone: boolean;
  needsPayment: boolean;
  pix: boolean;
}) {
  const steps: Step[] = [
    { icon: ThumbsUp, label: "Interesse", done: interestDone },
    ...(needsPayment ? [{ icon: CreditCard, label: pix ? "Pix pago" : "Pagamento", done: paymentDone }] : []),
    { icon: Users, label: "Na lista", done: listDone },
  ];

  return (
    <ol className="flex items-center gap-1.5" aria-label="Suas etapas neste racha">
      {steps.map((step, index) => {
        const Icon = step.done ? CheckCircle2 : step.icon;
        return (
          <li key={step.label} className="flex min-w-0 flex-1 items-center gap-1.5">
            <span
              className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl px-1.5 py-2 text-[11px] font-bold ${
                step.done ? "bg-emerald-400/15 text-emerald-100" : "bg-black/20 text-white/55"
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} />
              <span className="break-words text-center leading-tight">{step.label}</span>
            </span>
            {index < steps.length - 1 && <span aria-hidden className={`h-px w-2 shrink-0 ${step.done ? "bg-emerald-300/50" : "bg-white/15"}`} />}
          </li>
        );
      })}
    </ol>
  );
}

/** Cartão "Você está..." da tela do racha, com as etapas e o caminho pra lista. */
export function RachaMyStatus({
  status,
  listHref,
  canRespond,
  eventClosed,
  steps,
}: {
  status: "confirmed" | "interested" | "declined" | "none";
  listHref: string;
  canRespond: boolean;
  eventClosed: boolean;
  steps: { interestDone: boolean; paymentDone: boolean; listDone: boolean; needsPayment: boolean; pix: boolean };
}) {
  const tone =
    status === "confirmed"
      ? "border-emerald-300/40 bg-emerald-500/10"
      : status === "interested"
        ? "border-purple-300/35 bg-purple-400/10"
        : "border-white/12 bg-white/[0.035]";
  const title =
    status === "confirmed"
      ? "Você está confirmado(a) neste racha"
      : status === "interested"
        ? "Você marcou interesse neste racha"
        : status === "declined"
          ? "Você marcou que não vai neste racha"
          : canRespond
            ? "Você ainda não respondeu"
            : "Você está acompanhando este racha";
  const titleColor = status === "confirmed" ? "text-emerald-100" : "text-white";
  const showSteps = canRespond && (status === "confirmed" || status === "interested");
  const showAction = !eventClosed && status !== "confirmed";

  return (
    <section className={`rounded-2xl border p-3 ${tone}`}>
      <p className={`break-words text-sm font-bold ${titleColor}`}>{title}</p>
      {showSteps && (
        <div className="mt-2.5">
          <RachaSteps {...steps} />
        </div>
      )}
      {showAction && (
        <Link
          href={listHref}
          className="mt-2.5 flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-brand-purple px-3 text-sm font-bold text-white transition hover:bg-brand-purple-dark active:scale-[0.99]"
        >
          {canRespond ? (status === "interested" ? "Ver minha vaga na lista" : "Responder na lista") : "Ver a lista"}
          <ArrowRight className="h-4 w-4" strokeWidth={2.25} />
        </Link>
      )}
    </section>
  );
}
