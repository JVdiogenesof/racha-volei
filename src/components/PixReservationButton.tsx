"use client";

import { useEffect, useState, useTransition } from "react";
import { CheckCircle2, Copy, Loader2, QrCode } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "./Toast";
import { CopyPixButton } from "./CopyPixButton";
import { PIX_KEY } from "@/lib/payment";

type PixData = {
  qrCode: string;
  qrCodeBase64: string;
  ticketUrl: string;
  reservationExpiresAt: string;
};

export function PixReservationButton({
  eventId,
  hasInterest,
  isFull,
  blockedReason,
  guaranteedSpot = false,
  action,
}: {
  eventId: string;
  hasInterest: boolean;
  isFull: boolean;
  /** Impede gerar Pix quando a cota exclusiva da pessoa já foi preenchida. */
  blockedReason?: string | null;
  /** A organização já ocupou esta vaga; o Pix só conclui o pagamento. */
  guaranteedSpot?: boolean;
  action: (formData: FormData) => Promise<void> | void;
}) {
  const [isPending, startTransition] = useTransition();
  const [pix, setPix] = useState<PixData | null>(null);
  // Se o provedor falhar, a pessoa não fica sem saída: mostramos a chave Pix
  // manual do grupo e a organização confirma o nome na lista.
  const [failure, setFailure] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const { showToast } = useToast();
  const router = useRouter();

  useEffect(() => {
    if (!pix) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [pix]);

  useEffect(() => {
    if (!pix) return;
    const refresh = window.setInterval(() => router.refresh(), 4000);
    return () => window.clearInterval(refresh);
  }, [pix, router]);

  const seconds = pix ? Math.max(0, Math.ceil((new Date(pix.reservationExpiresAt).getTime() - now) / 1000)) : 0;
  const timerText = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

  function startPayment() {
    if (isFull || blockedReason) {
      showToast(blockedReason || "As vagas deste racha já foram reservadas.");
      return;
    }
    startTransition(async () => {
      try {
        if (!hasInterest && !guaranteedSpot) {
          const formData = new FormData();
          formData.set("eventId", eventId);
          formData.set("status", "interested");
          await action(formData);
        }
        const response = await fetch("/api/payments/mercado-pago/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventId }),
        });
        const payload = (await response.json()) as PixData & { error?: string };
        if (!response.ok || payload.error) throw new Error(payload.error || "Não foi possível gerar o Pix.");
        setNow(Date.now());
        setFailure(null);
        setPix(payload);
        router.refresh();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Não foi possível iniciar o pagamento.";
        showToast(message);
        setFailure(message);
        router.refresh();
      }
    });
  }

  async function copyCode() {
    if (!pix) return;
    try {
      await navigator.clipboard.writeText(pix.qrCode);
      showToast("Código Pix copiado!");
    } catch {
      showToast("Não foi possível copiar o código Pix.");
    }
  }

  if (pix) {
    if (seconds === 0) {
      return (
        <section className="w-full rounded-2xl border border-amber-300/25 bg-amber-400/10 p-4 text-center">
          <p className="text-sm font-bold text-amber-100">O prazo de reserva terminou.</p>
          <p className="mt-1 text-xs leading-relaxed text-amber-50/75">
            Se você já pagou, aguarde a confirmação. Caso ainda não tenha pago, tente reservar novamente para gerar uma nova vaga de 5 minutos.
          </p>
          <button
            type="button"
            onClick={() => setPix(null)}
            className="mt-3 inline-flex min-h-11 items-center justify-center rounded-xl border border-white/20 px-4 text-sm font-bold text-white transition hover:bg-white/10"
          >
            Tentar reservar novamente
          </button>
        </section>
      );
    }
    return (
      <section className="w-full rounded-2xl border border-emerald-300/25 bg-emerald-400/10 p-4 text-center">
        <div className="flex items-center justify-center gap-2 text-sm font-bold text-emerald-100">
          <QrCode className="h-4 w-4" /> Vaga reservada por {timerText}
        </div>
        <p className="mt-1 text-xs leading-relaxed text-emerald-50/75">Copie o código, pague no app do seu banco (Pix copia e cola) e seu nome entra na lista automaticamente.</p>
        <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-emerald-100/60">Pix copia e cola</p>
        <p className="mt-1 max-h-20 overflow-hidden break-all rounded-xl bg-black/20 px-3 py-2 text-left font-mono text-[11px] leading-snug text-white/80">{pix.qrCode}</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <button type="button" onClick={copyCode} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 text-sm font-bold text-white transition hover:bg-emerald-400">
            <Copy className="h-4 w-4" /> Copiar código Pix
          </button>
          <a href={pix.ticketUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-white/20 px-4 text-sm font-bold text-white transition hover:bg-white/10">
            Abrir pagamento
          </a>
        </div>
        <p className="mt-3 text-xs text-white/55">Após pagar, sua confirmação aparece automaticamente.</p>
      </section>
    );
  }

  if (failure) {
    return (
      <section className="w-full rounded-2xl border border-amber-300/25 bg-amber-400/10 p-4">
        <p className="text-sm font-bold text-amber-100">Não conseguimos gerar o QR Code agora.</p>
        <p className="mt-1 text-xs leading-relaxed text-amber-50/80">
          Seu interesse está registrado. Pague pela chave Pix abaixo e avise a organização para confirmar seu nome na lista.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-black/15 px-3 py-2.5">
          <span className="min-w-0 flex-1 break-all text-sm font-semibold text-white">{PIX_KEY}</span>
          <CopyPixButton pixKey={PIX_KEY} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-400" />
        </div>
        <p className="mt-2 text-[11px] text-amber-50/60">Detalhe: {failure}</p>
        <button
          type="button"
          onClick={() => setFailure(null)}
          className="mt-3 inline-flex min-h-10 items-center justify-center rounded-xl border border-white/20 px-4 text-sm font-bold text-white transition hover:bg-white/10"
        >
          Tentar gerar o QR Code de novo
        </button>
      </section>
    );
  }

  return (
    <button
      type="button"
      disabled={isPending || isFull || Boolean(blockedReason)}
      onClick={startPayment}
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 font-bold text-white shadow-lg shadow-emerald-950/30 transition hover:bg-emerald-400 disabled:opacity-60"
    >
      {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
      {blockedReason ? "Vagas de levantador preenchidas" : isFull ? "Vagas reservadas" : guaranteedSpot ? "Pagar vaga garantida por Pix" : hasInterest ? "Reservar e pagar por Pix" : "Tenho interesse e quero pagar"}
    </button>
  );
}
