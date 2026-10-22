"use client";

import { useEffect, useState } from "react";
import { PartyPopper } from "lucide-react";

const VISIBLE_MS = 6000;

/**
 * Banner fixo no topo avisando que o pagamento acabou de confirmar a vaga --
 * cobre tanto quem fica na tela vendo o Pix confirmar sozinho (polling do
 * PixReservationButton) quanto quem paga por fora (fecha o app, paga no
 * banco, volta depois): nos dois casos a página server-side manda um
 * `dedupeKey` (o `paid_at` do pagamento) só quando ele é recente.
 *
 * O `key={dedupeKey}` no filho monta uma instância nova a cada pagamento
 * novo, já nascendo visível -- assim o efeito só cuida do timer de
 * autodispensa (chamando setState no callback dele), sem precisar setar
 * estado direto no corpo do efeito.
 */
export function PaymentConfirmedBanner({ dedupeKey }: { dedupeKey: string | null }) {
  if (!dedupeKey) return null;
  return <PaymentConfirmedBannerContent key={dedupeKey} />;
}

function PaymentConfirmedBannerContent() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(false), VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center px-3 pt-3 sm:pt-4">
      <div
        role="status"
        className="animate-payment-banner-in pointer-events-auto w-full max-w-md overflow-hidden rounded-2xl border border-emerald-300/30 bg-emerald-500 shadow-xl shadow-emerald-950/40"
      >
        <div className="flex items-center gap-2.5 px-4 py-3">
          <PartyPopper className="h-5 w-5 shrink-0 text-white" strokeWidth={2.25} />
          <p className="text-sm font-bold leading-snug text-white">Pagamento confirmado! Você está na lista do racha.</p>
        </div>
        <div className="h-1 w-full bg-white/25">
          <div
            className="animate-payment-banner-bar h-full bg-white"
            style={{ animationDuration: `${VISIBLE_MS}ms` }}
          />
        </div>
      </div>
    </div>
  );
}
