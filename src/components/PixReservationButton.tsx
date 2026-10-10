"use client";

import { useEffect, useState, useTransition } from "react";
import { CheckCircle2, Copy, Loader2, QrCode } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "./Toast";

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
  action,
}: {
  eventId: string;
  hasInterest: boolean;
  isFull: boolean;
  action: (formData: FormData) => Promise<void> | void;
}) {
  const [isPending, startTransition] = useTransition();
  const [pix, setPix] = useState<PixData | null>(null);
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
    if (isFull) {
      showToast("As vagas deste racha já foram reservadas.");
      return;
    }
    startTransition(async () => {
      try {
        if (!hasInterest) {
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
        setPix(payload);
        router.refresh();
      } catch (error) {
        showToast(error instanceof Error ? error.message : "Não foi possível iniciar o pagamento.");
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
        <p className="mt-1 text-xs leading-relaxed text-emerald-50/75">Pague dentro do prazo para confirmar seu nome automaticamente.</p>
        <img
          src={`data:image/png;base64,${pix.qrCodeBase64}`}
          alt="QR Code para pagamento Pix"
          className="mx-auto mt-4 h-52 w-52 rounded-xl bg-white p-2"
        />
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

  return (
    <button
      type="button"
      disabled={isPending || isFull}
      onClick={startPayment}
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 font-bold text-white shadow-lg shadow-emerald-950/30 transition hover:bg-emerald-400 disabled:opacity-60"
    >
      {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
      {isFull ? "Vagas reservadas" : hasInterest ? "Reservar e pagar por Pix" : "Tenho interesse e quero pagar"}
    </button>
  );
}
