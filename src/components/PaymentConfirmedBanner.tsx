"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";

const VISIBLE_MS = 7000;
const SEEN_KEY = "vpa-pix-confirmed-seen";

/**
 * Comemoração de "pagamento confirmado" -- cobre tanto quem fica na tela vendo
 * o Pix confirmar sozinho quanto quem paga no banco e só volta depois: nos dois
 * casos a página server-side manda um `dedupeKey` (o `paid_at` do pagamento)
 * só quando ele é recente.
 *
 * O `key={dedupeKey}` no filho monta uma instância nova a cada pagamento novo.
 * O registro no sessionStorage evita repetir a comemoração se a tela recarregar.
 */
export function PaymentConfirmedBanner({ dedupeKey }: { dedupeKey: string | null }) {
  if (!dedupeKey) return null;
  return <PaymentConfirmedBannerContent key={dedupeKey} dedupeKey={dedupeKey} />;
}

function PaymentConfirmedBannerContent({ dedupeKey }: { dedupeKey: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let hideTimer: number | undefined;
    const showTimer = window.setTimeout(() => {
      try {
        if (window.sessionStorage.getItem(SEEN_KEY) === dedupeKey) return;
        window.sessionStorage.setItem(SEEN_KEY, dedupeKey);
      } catch {
        // Sem acesso ao armazenamento: só não evita a repetição.
      }
      setVisible(true);
      hideTimer = window.setTimeout(() => setVisible(false), VISIBLE_MS);
    }, 0);
    return () => {
      window.clearTimeout(showTimer);
      window.clearTimeout(hideTimer);
    };
  }, [dedupeKey]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-5 backdrop-blur-sm" onClick={() => setVisible(false)} role="presentation">
      <div
        role="status"
        className="animate-payment-sheet-in w-full max-w-sm overflow-hidden rounded-3xl border border-emerald-300/30 bg-gradient-to-br from-emerald-600 to-emerald-900 text-center shadow-2xl shadow-emerald-950/50"
      >
        <div className="px-6 pb-5 pt-7">
          <span className="relative mx-auto flex h-20 w-20 items-center justify-center">
            <span className="absolute inset-0 rounded-full bg-white/25 motion-safe:animate-ping" style={{ animationIterationCount: 2 }} />
            <span className="relative flex h-20 w-20 items-center justify-center rounded-full bg-white text-emerald-700">
              <Check className="h-11 w-11" strokeWidth={3.5} />
            </span>
          </span>
          <p className="mt-4 text-2xl font-black text-white">Pagamento confirmado!</p>
          <p className="mt-1 text-sm font-medium leading-snug text-emerald-50/90">Seu nome já está na lista. Bom racha! 🏐</p>
          <button type="button" onClick={() => setVisible(false)} className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-white font-bold text-emerald-800 hover:bg-emerald-50">
            Ver a lista
          </button>
        </div>
        <div className="h-1 w-full bg-white/25">
          <div className="animate-payment-banner-bar h-full bg-white" style={{ animationDuration: `${VISIBLE_MS}ms` }} />
        </div>
      </div>
    </div>
  );
}
