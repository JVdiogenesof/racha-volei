"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, CalendarClock, CheckCircle2, Clock3, Loader2, UserX } from "lucide-react";
import { PixCheckoutSheet, type PixData, type PixPhase } from "./PixCheckoutSheet";
import { useToast } from "./Toast";
import { confirmCupPresenceFree, declineCupPresence } from "@/app/(app)/torneios-vpa/copa/confirmar-actions";

const REQUEST_TIMEOUT_MS = 30_000;
const AUTO_ATTEMPTS = 3;
const POLL_MS = 5_000;
// O código Pix vale 30 minutos: até lá ainda dá pra reconhecer um pagamento atrasado.
const LATE_PAYMENT_WINDOW_MS = 31 * 60 * 1000;

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

type RequestResult =
  | { kind: "ok"; pix: PixData }
  | { kind: "paid" }
  | { kind: "blocked"; message: string }
  | { kind: "retry"; message: string };

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestPix(cupId: string): Promise<RequestResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch("/api/payments/copa/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cupId }),
      signal: controller.signal,
    });
    const payload = (await response.json().catch(() => null)) as (PixData & { error?: string; blocked?: boolean; alreadyPaid?: boolean }) | null;
    if (payload?.alreadyPaid) return { kind: "paid" };
    if (payload?.blocked) return { kind: "blocked", message: payload.error || "Não foi possível gerar o Pix." };
    if (!response.ok || !payload?.qrCode) return { kind: "retry", message: payload?.error || "Não conseguimos gerar o Pix agora." };
    return { kind: "ok", pix: payload };
  } catch {
    return { kind: "retry", message: "A conexão falhou enquanto gerávamos o Pix." };
  } finally {
    clearTimeout(timeout);
  }
}

function deadlineLabel(iso: string) {
  const date = new Date(iso);
  const day = date.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit", timeZone: "America/Fortaleza" });
  const time = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Fortaleza" }).replace(":", "h");
  return `${day}, às ${time}`;
}

function remainingLabel(ms: number) {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${Math.max(1, minutes)} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} h`;
  return `${Math.floor(hours / 24)} dias`;
}

export function CopaConfirmCard({
  cupId,
  cupName,
  amount,
  deadline,
  opensAt = null,
  status,
  source,
  activePix = false,
}: {
  cupId: string;
  cupName: string;
  /** Valor da confirmação; nulo = gratuita. */
  amount: number | null;
  /** Fim do prazo (ISO); nulo = a organização ainda não abriu a confirmação. */
  deadline: string | null;
  /** Quando a confirmação abre (ISO); nulo = já aberta. */
  opensAt?: string | null;
  status: "confirmed" | "declined" | null;
  source: "pix" | "free" | "manual" | null;
  /** Já existe um código Pix em aberto: reabre sozinho ao chegar. */
  activePix?: boolean;
}) {
  const [phase, setPhase] = useState<PixPhase>({ kind: "idle" });
  const [sheetOpen, setSheetOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [checkNotice, setCheckNotice] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [askDecline, setAskDecline] = useState(false);
  const [pending, startTransition] = useTransition();
  const busy = useRef(false);
  const checking = useRef(false);
  const started = useRef(false);
  const { showToast } = useToast();
  const router = useRouter();

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const startPayment = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    started.current = true;
    setCheckNotice(null);
    setSheetOpen(true);
    setPhase({ kind: "generating", slow: false });
    const slowTimer = window.setTimeout(() => setPhase({ kind: "generating", slow: true }), 5_000);
    try {
      for (let attempt = 1; ; attempt += 1) {
        const result = await requestPix(cupId);
        if (result.kind === "ok") {
          const expires = new Date(result.pix.reservationExpiresAt).getTime();
          const serverNow = new Date(result.pix.serverNow).getTime();
          setNow(Date.now());
          setPhase({ kind: "paying", pix: result.pix, clockOffset: serverNow - Date.now(), totalSeconds: Math.max(1, Math.ceil((expires - serverNow) / 1000)) });
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
        await wait(1200 * attempt + Math.random() * 800);
      }
    } finally {
      window.clearTimeout(slowTimer);
      busy.current = false;
    }
  }, [cupId, router]);

  // Voltou do app do banco e a tela recarregou: reabre o código em aberto.
  useEffect(() => {
    if (!activePix || started.current || status === "confirmed") return;
    const timer = window.setTimeout(() => void startPayment(), 0);
    return () => window.clearTimeout(timer);
  }, [activePix, startPayment, status]);

  const checkStatus = useCallback(async () => {
    if (checking.current) return "pending" as const;
    checking.current = true;
    try {
      const response = await fetch("/api/payments/copa/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cupId }),
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
  }, [cupId, router]);

  const payingPix = phase.kind === "paying" ? phase.pix : null;
  const clockOffset = phase.kind === "paying" ? phase.clockOffset : 0;

  useEffect(() => {
    if (!payingPix) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [payingPix]);

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
    if (phase.kind !== "paying" && phase.kind !== "generating") setPhase({ kind: "idle" });
  }

  function runRule(action: (cupId: string) => Promise<{ ok: true } | { ok: false; error: string }>, success: string) {
    startTransition(async () => {
      const result = await action(cupId);
      if (!result.ok) {
        showToast(result.error);
        router.refresh();
        return;
      }
      setAskDecline(false);
      showToast(success);
      router.refresh();
    });
  }

  const sheet = sheetOpen && phase.kind !== "idle" && (
    <PixCheckoutSheet
      copa
      guaranteedSpot
      phase={phase}
      secondsLeft={secondsLeft}
      eventLabel={cupName}
      checkNotice={checkNotice}
      isChecking={isChecking}
      onClose={closeSheet}
      onCheckNow={checkNow}
      onRetry={() => void startPayment()}
    />
  );

  // ---- Estados
  if (status === "confirmed") {
    return (
      <section className="flex items-start gap-3 rounded-2xl border border-emerald-300/35 bg-emerald-400/10 p-4">
        {sheet}
        <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-300" strokeWidth={2} />
        <div className="min-w-0 flex-1">
          <p className="font-bold text-emerald-50">Sua presença na {cupName} está confirmada!</p>
          <p className="mt-0.5 text-sm leading-relaxed text-emerald-50/75">
            {source === "free"
              ? "Obrigado por confirmar. Se algo mudar, avise aqui antes do prazo para liberar sua vaga."
              : "Pagamento recebido. Se precisar cancelar, fale com a organização para combinar a devolução."}
          </p>
          {source === "free" && deadline && new Date(deadline).getTime() > now && (
            <DeclineControls ask={askDecline} setAsk={setAskDecline} pending={pending} onDecline={() => runRule(declineCupPresence, "Tudo bem, sua vaga foi liberada.")} label="Não vou mais poder ir" />
          )}
        </div>
      </section>
    );
  }

  if (!deadline) {
    return (
      <section className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <CalendarClock className="mt-0.5 h-6 w-6 shrink-0 text-purple-300" strokeWidth={2} />
        <div>
          <p className="font-bold text-white">Confirmação de presença em breve</p>
          <p className="mt-0.5 text-sm leading-relaxed text-white/65">A organização vai abrir a confirmação aqui, com o prazo. Você será avisado(a).</p>
        </div>
      </section>
    );
  }

  // Antes da abertura: avisa quando o pagamento começa (o banco também recusa o Pix até lá).
  if (opensAt && new Date(opensAt).getTime() > now) {
    return (
      <section className="flex items-start gap-3 rounded-2xl border border-pink-300/35 bg-gradient-to-br from-pink-400/15 to-transparent p-4">
        <CalendarClock className="mt-0.5 h-6 w-6 shrink-0 text-pink-300" strokeWidth={2} />
        <div>
          <p className="font-bold text-white">Confirmação da {cupName} abre {deadlineLabel(opensAt)}</p>
          <p className="mt-0.5 text-sm leading-relaxed text-white/70">
            {amount != null ? `Pague ${money.format(amount)} por Pix aqui mesmo` : "Confirme aqui mesmo"}, de {deadlineLabel(opensAt)} até {deadlineLabel(deadline)}. Só fica com a vaga quem confirmar nesse período.
          </p>
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-black/25 px-2.5 py-1 text-xs font-semibold text-white/85">
            <Clock3 className="h-3.5 w-3.5" /> Abre em {remainingLabel(new Date(opensAt).getTime() - now)}
          </p>
        </div>
      </section>
    );
  }

  const expired = new Date(deadline).getTime() <= now;
  if (expired) {
    return (
      <section className="flex items-start gap-3 rounded-2xl border border-amber-300/25 bg-amber-400/10 p-4">
        <Clock3 className="mt-0.5 h-6 w-6 shrink-0 text-amber-300" strokeWidth={2} />
        <div>
          <p className="font-bold text-amber-50">O prazo para confirmar terminou</p>
          <p className="mt-0.5 text-sm leading-relaxed text-amber-50/75">
            {status === "declined" ? "Você avisou que não vai poder ir." : "Quem não confirmou pode perder a vaga. Fale com a organização se ainda quiser participar."}
          </p>
        </div>
      </section>
    );
  }

  const remaining = new Date(deadline).getTime() - now;
  const isDeclined = status === "declined";
  return (
    <section className="rounded-2xl border border-pink-300/35 bg-gradient-to-br from-pink-400/15 to-transparent p-4">
      {sheet}
      <div className="flex items-start gap-3">
        {isDeclined ? <UserX className="mt-0.5 h-6 w-6 shrink-0 text-white/50" strokeWidth={2} /> : <BadgeCheck className="mt-0.5 h-6 w-6 shrink-0 text-pink-300" strokeWidth={2} />}
        <div className="min-w-0 flex-1">
          <p className="font-bold text-white">{isDeclined ? "Você avisou que não vai poder ir" : `Confirme sua presença na ${cupName}`}</p>
          <p className="mt-0.5 text-sm leading-relaxed text-white/70">
            {isDeclined ? "Mudou de ideia? Ainda dá tempo de confirmar." : "Sua vaga é garantida só para quem confirmar até o prazo."}
          </p>
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-black/25 px-2.5 py-1 text-xs font-semibold text-white/85">
            <Clock3 className="h-3.5 w-3.5" /> Até {deadlineLabel(deadline)} · faltam {remainingLabel(remaining)}
          </p>
        </div>
      </div>

      {amount != null ? (
        <button
          type="button"
          onClick={() => void startPayment()}
          disabled={phase.kind === "generating"}
          className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 font-bold text-white shadow-lg shadow-emerald-950/30 transition hover:bg-emerald-400 disabled:opacity-60"
        >
          {phase.kind === "generating" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Confirmar e pagar {money.format(amount)} por Pix
        </button>
      ) : (
        <button
          type="button"
          onClick={() => runRule(confirmCupPresenceFree, "Presença confirmada!")}
          disabled={pending}
          className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 font-bold text-white shadow-lg shadow-emerald-950/30 transition hover:bg-emerald-400 disabled:opacity-60"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Confirmar presença
        </button>
      )}
      {!isDeclined && (
        <DeclineControls ask={askDecline} setAsk={setAskDecline} pending={pending} onDecline={() => runRule(declineCupPresence, "Tudo bem, sua vaga foi liberada.")} label="Não vou poder ir" />
      )}
    </section>
  );
}

function DeclineControls({
  ask,
  setAsk,
  pending,
  onDecline,
  label,
}: {
  ask: boolean;
  setAsk: (value: boolean) => void;
  pending: boolean;
  onDecline: () => void;
  label: string;
}) {
  if (!ask) {
    return (
      <button type="button" onClick={() => setAsk(true)} className="mt-2 min-h-10 w-full text-sm font-semibold text-white/60 hover:text-white">
        {label}
      </button>
    );
  }
  return (
    <div className="mt-2 rounded-xl border border-white/15 bg-black/20 p-3">
      <p className="text-sm font-semibold text-white">Liberar sua vaga na Copa?</p>
      <p className="mt-0.5 text-xs leading-relaxed text-white/65">A organização poderá chamar outra pessoa no seu lugar.</p>
      <div className="mt-2 flex gap-2">
        <button type="button" onClick={onDecline} disabled={pending} className="inline-flex min-h-10 flex-1 items-center justify-center rounded-lg bg-red-500/80 text-sm font-bold text-white hover:bg-red-500 disabled:opacity-60">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sim, liberar"}
        </button>
        <button type="button" onClick={() => setAsk(false)} className="inline-flex min-h-10 flex-1 items-center justify-center rounded-lg border border-white/20 text-sm font-semibold text-white/80 hover:bg-white/5">
          Voltar
        </button>
      </div>
    </div>
  );
}
