"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Clock3, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { PixCheckoutSheet, formatTimer, type PixData, type PixPhase } from "./PixCheckoutSheet";
import { useToast } from "./Toast";

// Cada tentativa espera no máximo isso (o servidor já tenta o Mercado Pago duas vezes).
const REQUEST_TIMEOUT_MS = 30_000;
// Tentativas sozinhas antes de pedir ajuda à pessoa: repetir é seguro porque a
// reserva pendente e a cobrança são reaproveitadas.
const AUTO_ATTEMPTS = 3;
const SLOW_NOTICE_MS = 5_000;
const POLL_MS = 5_000;
// A cobrança vale 30 minutos no Mercado Pago: até lá ainda dá pra reconhecer um pagamento atrasado.
const LATE_PAYMENT_WINDOW_MS = 31 * 60 * 1000;

type RequestResult =
  | { kind: "ok"; pix: PixData }
  | { kind: "paid" }
  | { kind: "blocked"; message: string }
  | { kind: "retry"; message: string };

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestPix(eventId: string): Promise<RequestResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch("/api/payments/mercado-pago/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId }),
      signal: controller.signal,
    });
    // Uma resposta de erro da hospedagem pode nem ser JSON.
    const payload = (await response.json().catch(() => null)) as (PixData & { error?: string; blocked?: boolean; alreadyPaid?: boolean }) | null;
    if (payload?.alreadyPaid) return { kind: "paid" };
    if (payload?.blocked) return { kind: "blocked", message: payload.error || "Não foi possível reservar sua vaga." };
    if (!response.ok || !payload?.qrCode) return { kind: "retry", message: payload?.error || "Não conseguimos gerar o Pix agora." };
    return { kind: "ok", pix: payload };
  } catch {
    return { kind: "retry", message: "A conexão falhou enquanto gerávamos o Pix." };
  } finally {
    clearTimeout(timeout);
  }
}

export function PixReservationButton({
  eventId,
  hasInterest,
  isFull,
  blockedReason,
  guaranteedSpot = false,
  activeReservation = false,
  autoStart = false,
  eventLabel,
  action,
}: {
  eventId: string;
  hasInterest: boolean;
  isFull: boolean;
  /** Impede gerar Pix enquanto a última vaga está guardada para a fila de interessados. */
  blockedReason?: string | null;
  /** A organização já ocupou esta vaga; o Pix só conclui o pagamento. */
  guaranteedSpot?: boolean;
  /** Já existe uma reserva em aberto: reabre o código sozinho (ex.: voltou do app do banco e a tela recarregou). */
  activeReservation?: boolean;
  /** A pessoa veio de um botão "Quero jogar" ou "Pagar": já abre o pagamento ao chegar. */
  autoStart?: boolean;
  /** Dia do racha, mostrado na tela de pagamento. */
  eventLabel?: string;
  action: (formData: FormData) => Promise<void> | void;
}) {
  const [phase, setPhase] = useState<PixPhase>({ kind: "idle" });
  const [sheetOpen, setSheetOpen] = useState(false);
  const [now, setNow] = useState(0);
  const [checkNotice, setCheckNotice] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const busy = useRef(false);
  const interestDone = useRef(false);
  const checking = useRef(false);
  const started = useRef(false);
  const { showToast } = useToast();
  const router = useRouter();

  const startPayment = useCallback(
    async (resuming = false) => {
      if (busy.current) return;
      busy.current = true;
      started.current = true;
      setCheckNotice(null);
      setSheetOpen(true);
      setPhase({ kind: "generating", slow: false });
      const slowTimer = window.setTimeout(() => setPhase({ kind: "generating", slow: true }), SLOW_NOTICE_MS);
      try {
        if (!resuming && !hasInterest && !guaranteedSpot && !interestDone.current) {
          const formData = new FormData();
          formData.set("eventId", eventId);
          formData.set("status", "interested");
          try {
            await action(formData);
            interestDone.current = true;
          } catch (interestError) {
            // Em produção o Next esconde o texto do erro da action, então
            // uma mensagem que não é nossa é tratada como falha técnica.
            const message = interestError instanceof Error ? interestError.message : "";
            const ours = /inscri|racha|responder/i.test(message) && !/server component/i.test(message);
            setPhase(ours ? { kind: "blocked", message } : { kind: "failure", message: "Não conseguimos registrar seu pedido." });
            router.refresh();
            return;
          }
        }

        for (let attempt = 1; ; attempt += 1) {
          const result = await requestPix(eventId);
          if (result.kind === "ok") {
            const expires = new Date(result.pix.reservationExpiresAt).getTime();
            const serverNow = new Date(result.pix.serverNow).getTime();
            const clockOffset = serverNow - Date.now();
            setNow(Date.now());
            setPhase({ kind: "paying", pix: result.pix, clockOffset, totalSeconds: Math.max(1, Math.ceil((expires - serverNow) / 1000)) });
            return;
          }
          if (result.kind === "paid") {
            setPhase({ kind: "paid" });
            router.refresh();
            return;
          }
          if (result.kind === "blocked") {
            setPhase({ kind: "blocked", message: result.message });
            router.refresh();
            return;
          }
          if (attempt >= AUTO_ATTEMPTS) {
            setPhase({ kind: "failure", message: result.message });
            return;
          }
          // Intervalo um pouco diferente pra cada pessoa, pra não voltarem todas juntas.
          await wait(1200 * attempt + Math.random() * 800);
        }
      } finally {
        window.clearTimeout(slowTimer);
        busy.current = false;
      }
    },
    [action, eventId, guaranteedSpot, hasInterest, router],
  );

  // Reabre o pagamento em aberto. Fora do corpo do efeito porque a tela de
  // pagamento só existe no navegador.
  const shouldStart = activeReservation || (autoStart && !isFull && !blockedReason);
  useEffect(() => {
    if (!shouldStart || started.current) return;
    const timer = window.setTimeout(() => {
      // Tira o "pagar=1" do endereço: recarregar a tela não pode gerar outra reserva.
      if (autoStart) window.history.replaceState(null, "", window.location.pathname);
      void startPayment(activeReservation);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [activeReservation, autoStart, shouldStart, startPayment]);

  const checkStatus = useCallback(async () => {
    if (checking.current) return "pending" as const;
    checking.current = true;
    try {
      const response = await fetch("/api/payments/mercado-pago/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId }),
      });
      const payload = (await response.json().catch(() => null)) as { paid?: boolean; credited?: boolean } | null;
      if (payload?.paid) {
        setPhase({ kind: "paid" });
        setSheetOpen(true);
        router.refresh();
        return "paid" as const;
      }
      if (payload?.credited) {
        setPhase({ kind: "credited" });
        setSheetOpen(true);
        router.refresh();
        return "credited" as const;
      }
    } catch {
      // tenta de novo no próximo ciclo
    } finally {
      checking.current = false;
    }
    return "pending" as const;
  }, [eventId, router]);

  const payingPix = phase.kind === "paying" ? phase.pix : null;
  const clockOffset = phase.kind === "paying" ? phase.clockOffset : 0;

  useEffect(() => {
    if (!payingPix) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [payingPix]);

  // Confere o pagamento direto no Mercado Pago, sem depender só do aviso
  // (webhook). A lista só é recarregada quando o pagamento entra: recarregar a
  // cada ciclo pesaria muito com várias pessoas pagando ao mesmo tempo.
  useEffect(() => {
    if (!payingPix) return;
    const giveUpAt = new Date(payingPix.reservationExpiresAt).getTime() + LATE_PAYMENT_WINDOW_MS;
    let stopped = false;
    let timer: number | undefined;

    const schedule = () => {
      if (stopped || Date.now() + clockOffset > giveUpAt) return;
      timer = window.setTimeout(run, POLL_MS + Math.random() * 1500);
    };
    const run = async () => {
      // Com a tela escondida (no app do banco) espera a volta, que confere na hora.
      const result = document.hidden ? "pending" : await checkStatus();
      if (result === "pending") schedule();
    };
    const onReturn = () => {
      if (document.hidden || stopped) return;
      window.clearTimeout(timer);
      void run();
    };

    schedule();
    document.addEventListener("visibilitychange", onReturn);
    window.addEventListener("pageshow", onReturn);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onReturn);
      window.removeEventListener("pageshow", onReturn);
    };
  }, [payingPix, clockOffset, checkStatus]);

  const secondsLeft = payingPix ? Math.max(0, Math.ceil((new Date(payingPix.reservationExpiresAt).getTime() - (now + clockOffset)) / 1000)) : 0;

  async function checkNow() {
    setIsChecking(true);
    setCheckNotice(null);
    const result = await checkStatus();
    setIsChecking(false);
    if (result === "pending") setCheckNotice("Ainda não recebemos o pagamento. Se acabou de pagar, ele costuma chegar em alguns segundos.");
  }

  function closeSheet() {
    setSheetOpen(false);
    // Sem pagamento em andamento não há o que retomar: volta ao botão.
    if (phase.kind !== "paying" && phase.kind !== "generating") setPhase({ kind: "idle" });
  }

  function handleMainClick() {
    if (isFull || blockedReason) {
      showToast(blockedReason || "As vagas deste racha já foram reservadas.");
      return;
    }
    void startPayment();
  }

  const sheet = sheetOpen && phase.kind !== "idle" && (
    <PixCheckoutSheet
      phase={phase}
      secondsLeft={secondsLeft}
      eventLabel={eventLabel}
      guaranteedSpot={guaranteedSpot}
      checkNotice={checkNotice}
      isChecking={isChecking}
      onClose={closeSheet}
      onCheckNow={checkNow}
      onRetry={() => void startPayment(interestDone.current || hasInterest || guaranteedSpot)}
    />
  );

  if (phase.kind === "paying") {
    const expired = secondsLeft === 0;
    return (
      <>
        {sheet}
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className={`flex min-h-11 w-full min-w-0 flex-1 items-center justify-between gap-3 rounded-xl px-4 py-2.5 text-left font-bold text-white shadow-lg shadow-emerald-950/30 transition ${expired ? "bg-amber-500 hover:bg-amber-400" : "bg-emerald-500 hover:bg-emerald-400"}`}
        >
          <span className="min-w-0 text-sm leading-tight">{expired ? (guaranteedSpot ? "O prazo do código terminou" : "O prazo da reserva terminou") : "Continuar pagamento"}</span>
          <span className="inline-flex shrink-0 items-center gap-1.5 text-sm tabular-nums">
            {expired ? "Ver" : <><Clock3 className="h-4 w-4" /> {formatTimer(secondsLeft)}</>}
          </span>
        </button>
      </>
    );
  }

  const generating = phase.kind === "generating";
  const label = activeReservation
    ? "Continuar pagamento"
    : blockedReason
      ? "Vaga guardada para a fila"
      : isFull
        ? "Vagas reservadas"
        : guaranteedSpot
          ? "Pagar vaga garantida por Pix"
          : hasInterest
            ? "Pagar o Pix e garantir vaga"
            : "Quero jogar e pagar o Pix";

  return (
    <>
      {sheet}
      <button
        type="button"
        disabled={generating || (!activeReservation && (isFull || Boolean(blockedReason)))}
        onClick={activeReservation ? () => void startPayment(true) : handleMainClick}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 font-bold text-white shadow-lg shadow-emerald-950/30 transition hover:bg-emerald-400 disabled:opacity-60"
      >
        {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
        {label}
      </button>
    </>
  );
}
