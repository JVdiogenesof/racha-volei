"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Check, ChevronDown, Clock3, Copy, ExternalLink, Loader2, Lock, PartyPopper, RefreshCw, Wallet, X } from "lucide-react";

export type PixData = {
  qrCode: string;
  qrCodeBase64: string;
  ticketUrl: string;
  amount: number;
  reservationExpiresAt: string;
  serverNow: string;
  fellBackToRegular?: boolean;
};

export type PixPhase =
  | { kind: "idle" }
  | { kind: "generating"; slow: boolean }
  | { kind: "paying"; pix: PixData; clockOffset: number; totalSeconds: number }
  | { kind: "paid" }
  | { kind: "credited" }
  | { kind: "blocked"; message: string }
  | { kind: "failure"; message: string };

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatTimer(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** Alguns navegadores embutidos bloqueiam a área de transferência moderna. */
async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const field = document.createElement("textarea");
    field.value = text;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.appendChild(field);
    field.select();
    field.setSelectionRange(0, text.length);
    let copied = false;
    try {
      copied = document.execCommand("copy");
    } catch {
      copied = false;
    }
    field.remove();
    return copied;
  }
}

function Step({ number, done, title, children }: { number: number; done?: boolean; title: string; children?: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-black transition-colors ${done ? "bg-emerald-400 text-emerald-950" : "bg-white/12 text-white"}`}>
        {done ? <Check className="h-4 w-4" strokeWidth={3.5} /> : number}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold leading-snug text-white">{title}</p>
        {children}
      </div>
    </li>
  );
}

function PayingContent({
  phase,
  secondsLeft,
  eventLabel,
  guaranteedSpot,
  checkNotice,
  isChecking,
  onCheckNow,
  onRetry,
  onClose,
}: {
  phase: Extract<PixPhase, { kind: "paying" }>;
  secondsLeft: number;
  eventLabel?: string;
  guaranteedSpot: boolean;
  checkNotice: string | null;
  isChecking: boolean;
  onCheckNow: () => void;
  onRetry: () => void;
  onClose: () => void;
}) {
  const { pix, totalSeconds } = phase;
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  async function handleCopy() {
    setCopyState((await copyText(pix.qrCode)) ? "copied" : "failed");
  }

  if (secondsLeft === 0) {
    return (
      <div className="px-5 pb-6 pt-1 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-400/15 text-amber-300">
          <Clock3 className="h-7 w-7" />
        </span>
        <h2 id="pix-sheet-title" className="mt-3 text-xl font-black text-white">{guaranteedSpot ? "O prazo deste código terminou" : "O prazo da reserva terminou"}</h2>
        <p className="mt-2 text-sm leading-relaxed text-white/70">
          {guaranteedSpot ? "Sua vaga garantida continua sua. Se ainda não pagou, é só gerar um novo código." : "A vaga voltou para a lista porque o pagamento não chegou a tempo."}
        </p>
        <div className="mt-4 rounded-2xl border border-amber-300/25 bg-amber-400/10 p-3 text-left">
          <p className="text-sm font-bold text-amber-100">Já pagou? Não gere outro código.</p>
          <p className="mt-1 text-xs leading-relaxed text-amber-50/75">
            {guaranteedSpot ? "Continuamos conferindo por aqui e o pagamento aparece assim que for reconhecido." : "Continuamos conferindo por aqui. Se ainda houver vaga, você entra na lista. Se não houver, o valor vira saldo para outro racha."}
          </p>
          <button type="button" onClick={onCheckNow} disabled={isChecking} className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-white/20 text-sm font-bold text-white hover:bg-white/10 disabled:opacity-60">
            {isChecking ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Conferir meu pagamento
          </button>
          {checkNotice && <p role="status" className="mt-2 text-xs leading-relaxed text-amber-50/80">{checkNotice}</p>}
        </div>
        <button type="button" onClick={onRetry} className="mt-3 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-emerald-500 font-bold text-white hover:bg-emerald-400">
          {guaranteedSpot ? "Ainda não paguei: gerar novo código" : "Ainda não paguei: reservar de novo"}
        </button>
        <button type="button" onClick={onClose} className="mt-2 min-h-10 w-full text-sm font-semibold text-white/60 hover:text-white">Fechar</button>
      </div>
    );
  }

  const percent = Math.min(100, (secondsLeft / totalSeconds) * 100);
  const urgent = secondsLeft <= 60;
  const warning = secondsLeft <= 120;
  const copied = copyState === "copied";

  return (
    <div className="px-5 pb-6 pt-1">
      <p className="text-xs font-bold uppercase tracking-wide text-emerald-300">{guaranteedSpot ? "Vaga garantida · falta o pagamento" : "Falta só o pagamento"}</p>
      <div className="mt-1 flex items-end justify-between gap-3">
        <h2 id="pix-sheet-title" className="text-3xl font-black tabular-nums text-white">{money.format(pix.amount)}</h2>
        {eventLabel && <p className="pb-1 text-right text-xs font-medium text-white/60">Racha de {eventLabel}</p>}
      </div>

      <div className={`mt-3 rounded-2xl border p-3 ${urgent ? "border-red-300/30 bg-red-500/10" : warning ? "border-amber-300/25 bg-amber-400/10" : "border-white/10 bg-white/5"}`}>
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-white/85">
            <Lock className="h-3.5 w-3.5" /> {guaranteedSpot ? "Este código vale por" : "Sua vaga está guardada por"}
          </span>
          <span className={`text-xl font-black tabular-nums ${urgent ? "text-red-200" : warning ? "text-amber-200" : "text-white"}`} role="timer">{formatTimer(secondsLeft)}</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className={`h-full rounded-full transition-[width] duration-1000 ease-linear ${urgent ? "bg-red-400" : warning ? "bg-amber-400" : "bg-emerald-400"}`} style={{ width: `${percent}%` }} />
        </div>
      </div>

      {pix.fellBackToRegular && (
        <p className="mt-3 rounded-xl border border-cyan-300/25 bg-cyan-400/10 px-3 py-2 text-xs leading-relaxed text-cyan-100">
          As vagas de levantador já estavam cheias: essa reserva é como jogador comum (atacante).
        </p>
      )}

      <ol className="mt-4 space-y-3.5">
        <Step number={1} done={copied} title="Copie o código Pix">
          <button
            type="button"
            onClick={handleCopy}
            className={`mt-2 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl font-bold text-white transition ${copied ? "border border-emerald-300/40 bg-emerald-500/20" : "bg-emerald-500 shadow-lg shadow-emerald-950/40 hover:bg-emerald-400"}`}
          >
            {copied ? <Check className="h-5 w-5" strokeWidth={3} /> : <Copy className="h-5 w-5" />}
            {copied ? "Código copiado! Copiar de novo" : "Copiar código Pix"}
          </button>
          {copyState === "failed" && (
            <div className="mt-2">
              <p className="text-xs font-semibold text-amber-200">Seu navegador não deixou copiar. Toque no código abaixo, selecione tudo e copie:</p>
              <textarea readOnly value={pix.qrCode} rows={3} onFocus={(event) => event.currentTarget.select()} className="mt-1 w-full resize-none rounded-xl bg-black/30 p-2 font-mono text-[11px] leading-snug text-white/85" />
            </div>
          )}
        </Step>
        <Step number={2} title="Pague no app do seu banco">
          <p className="mt-0.5 text-xs leading-relaxed text-white/65">Entre em Pix, escolha <strong className="text-white/90">Pix Copia e Cola</strong>, cole o código e confirme.</p>
        </Step>
        <Step number={3} title="Volte aqui">
          <p className="mt-0.5 text-xs leading-relaxed text-white/65">Seu nome entra na lista sozinho, em poucos segundos. Não precisa mandar comprovante.</p>
        </Step>
      </ol>

      <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-3" aria-live="polite">
        <p className="flex items-center gap-2 text-sm font-semibold text-white/85">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70 motion-reduce:hidden" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
          </span>
          Aguardando seu pagamento...
        </p>
        <button type="button" onClick={onCheckNow} disabled={isChecking} className="mt-2 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-white/15 text-sm font-bold text-white hover:bg-white/10 disabled:opacity-60">
          {isChecking ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Já paguei, conferir agora
        </button>
        {checkNotice && <p role="status" className="mt-2 text-xs leading-relaxed text-white/65">{checkNotice}</p>}
      </div>

      <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-amber-200/85">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Pague só por este código. Pix para uma chave salva não é reconhecido e não garante a vaga.
      </p>

      <details className="group mt-3 rounded-2xl border border-white/10 bg-white/[0.03]">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3 text-sm font-semibold text-white/80">
          Vai pagar em outro aparelho? Ver QR Code
          <ChevronDown className="h-4 w-4 shrink-0 transition group-open:rotate-180" />
        </summary>
        <div className="px-3 pb-3 text-center">
          <div className="mx-auto w-fit rounded-2xl bg-white p-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- imagem gerada pelo Mercado Pago, vem como base64 */}
            <img src={`data:image/png;base64,${pix.qrCodeBase64}`} alt="QR Code do Pix" width={200} height={200} className="h-48 w-48" />
          </div>
          <a href={pix.ticketUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex min-h-10 items-center justify-center gap-1.5 text-sm font-semibold text-purple-200 hover:text-white">
            Abrir a página do Mercado Pago <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </details>

      <button type="button" onClick={onClose} className="mt-3 min-h-10 w-full text-sm font-semibold text-white/60 hover:text-white">
        Fechar e pagar depois
        <span className="block text-[11px] font-normal text-white/40">{guaranteedSpot ? "Sua vaga garantida continua sua" : "A vaga fica guardada até o tempo acabar"}</span>
      </button>
    </div>
  );
}

function MessageContent({
  icon,
  tone,
  title,
  text,
  hint,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
}: {
  icon: React.ReactNode;
  tone: "amber" | "orange" | "emerald";
  title: string;
  text: string;
  hint?: string;
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}) {
  const toneClass = { amber: "bg-amber-400/15 text-amber-300", orange: "bg-orange-400/15 text-orange-300", emerald: "bg-emerald-400/15 text-emerald-300" }[tone];
  return (
    <div className="px-5 pb-6 pt-1 text-center">
      <span className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${toneClass}`}>{icon}</span>
      <h2 id="pix-sheet-title" className="mt-3 text-xl font-black text-white">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-white/75">{text}</p>
      {hint && <p className="mt-2 text-xs leading-relaxed text-white/55">{hint}</p>}
      <button type="button" onClick={onPrimary} className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-emerald-500 font-bold text-white hover:bg-emerald-400">{primaryLabel}</button>
      {secondaryLabel && (
        <button type="button" onClick={onSecondary} className="mt-2 min-h-10 w-full text-sm font-semibold text-white/60 hover:text-white">{secondaryLabel}</button>
      )}
    </div>
  );
}

/** Tela de pagamento: abre por cima de tudo e guia a pessoa do código até a confirmação. */
export function PixCheckoutSheet({
  phase,
  secondsLeft,
  eventLabel,
  guaranteedSpot = false,
  checkNotice,
  isChecking,
  onClose,
  onCheckNow,
  onRetry,
}: {
  phase: Exclude<PixPhase, { kind: "idle" }>;
  secondsLeft: number;
  eventLabel?: string;
  /** A vaga já é da pessoa (organização garantiu): o prazo vale só para o código. */
  guaranteedSpot?: boolean;
  checkNotice: string | null;
  isChecking: boolean;
  onClose: () => void;
  onCheckNow: () => void;
  onRetry: () => void;
}) {
  const panel = useRef<HTMLElement>(null);
  const closable = phase.kind !== "generating";

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    if (!closable) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closable, onClose]);

  let content: React.ReactNode;
  if (phase.kind === "generating") {
    content = (
      <div className="px-5 pb-8 pt-3 text-center" aria-live="polite">
        <Loader2 className="mx-auto h-10 w-10 animate-spin text-emerald-300" />
        <h2 id="pix-sheet-title" className="mt-4 text-xl font-black text-white">{guaranteedSpot ? "Gerando seu Pix..." : "Guardando sua vaga..."}</h2>
        <p className="mt-2 text-sm leading-relaxed text-white/70">{guaranteedSpot ? "Sua vaga já está garantida. Só falta o código para pagar." : "Estamos reservando a vaga e gerando o seu Pix."}</p>
        {phase.slow && (
          <p className="mt-3 rounded-xl bg-white/5 px-3 py-2 text-xs leading-relaxed text-white/70">
            Tem bastante gente entrando agora. Não precisa tocar de novo: continuamos tentando sozinhos.
          </p>
        )}
      </div>
    );
  } else if (phase.kind === "paying") {
    content = (
      <PayingContent
        phase={phase}
        secondsLeft={secondsLeft}
        eventLabel={eventLabel}
        guaranteedSpot={guaranteedSpot}
        checkNotice={checkNotice}
        isChecking={isChecking}
        onCheckNow={onCheckNow}
        onRetry={onRetry}
        onClose={onClose}
      />
    );
  } else if (phase.kind === "paid") {
    content = (
      <MessageContent
        icon={<PartyPopper className="h-7 w-7" />}
        tone="emerald"
        title="Pagamento confirmado!"
        text="Você está na lista do racha."
        primaryLabel="Ver a lista"
        onPrimary={onClose}
      />
    );
  } else if (phase.kind === "credited") {
    content = (
      <MessageContent
        icon={<Wallet className="h-7 w-7" />}
        tone="amber"
        title="Seu Pix virou saldo"
        text="O pagamento chegou depois do prazo e a vaga já tinha sido preenchida. O valor ficou como saldo para usar em outro racha."
        primaryLabel="Entendi"
        onPrimary={onClose}
      />
    );
  } else if (phase.kind === "blocked") {
    const full = /vagas/i.test(phase.message);
    content = (
      <MessageContent
        icon={<AlertTriangle className="h-7 w-7" />}
        tone="orange"
        title={full ? "As vagas acabaram de ser ocupadas" : "Não deu para reservar sua vaga"}
        text={phase.message}
        hint={full
          ? "Não pague nada por fora. Quem não paga em 5 minutos libera a vaga: vale tentar de novo daqui a pouco."
          : "Não pague nada por fora: sem vaga reservada, o pagamento não garante lugar."}
        primaryLabel={full ? "Tentar de novo" : "Entendi"}
        onPrimary={full ? onRetry : onClose}
        secondaryLabel={full ? "Fechar" : undefined}
        onSecondary={full ? onClose : undefined}
      />
    );
  } else {
    content = (
      <MessageContent
        icon={<RefreshCw className="h-7 w-7" />}
        tone="amber"
        title="Não conseguimos gerar o Pix"
        text={phase.message}
        hint="Nada foi cobrado. Tente de novo em instantes e não pague por fora."
        primaryLabel="Tentar de novo"
        onPrimary={onRetry}
        secondaryLabel="Fechar"
        onSecondary={onClose}
      />
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4" role="presentation">
      <section
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pix-sheet-title"
        className="animate-payment-sheet-in max-h-[94dvh] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-3xl border border-white/15 bg-gradient-to-br from-[#2a1a58] to-[#11132e] pb-[env(safe-area-inset-bottom)] shadow-2xl outline-none sm:rounded-3xl"
      >
        <div className="flex items-center justify-between px-5 pt-3">
          <span className="text-xs font-bold text-white/45">Pagamento por Pix</span>
          {closable ? (
            <button type="button" onClick={onClose} aria-label="Fechar" className="-mr-2 flex h-10 w-10 items-center justify-center rounded-full text-white/60 hover:bg-white/10 hover:text-white">
              <X className="h-5 w-5" />
            </button>
          ) : (
            <span className="h-10" />
          )}
        </div>
        {content}
      </section>
    </div>,
    document.body,
  );
}
