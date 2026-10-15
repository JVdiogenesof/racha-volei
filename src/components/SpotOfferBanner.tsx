"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlarmClock, Check, X } from "lucide-react";
import { ActionForm } from "./ActionForm";

function remainingLabel(expiresAt: string): string | null {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return null;
  const totalSeconds = Math.floor(diff / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/** Banner pra quem foi chamado(a) da fila de interessados: tem até o horário
 * marcado pra aceitar a vaga, senão ela passa pra próxima pessoa. */
export function SpotOfferBanner({
  eventId,
  expiresAt,
  acceptAction,
  declineAction,
}: {
  eventId: string;
  expiresAt: string;
  acceptAction: (formData: FormData) => Promise<void> | void;
  declineAction: (formData: FormData) => Promise<void> | void;
}) {
  const router = useRouter();
  const [label, setLabel] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let refreshed = false;
    const update = () => {
      const next = remainingLabel(expiresAt);
      setLabel(next);
      if (!next && !refreshed) {
        refreshed = true;
        router.refresh();
      }
    };
    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, [expiresAt, router]);

  if (label === null) return null;

  return (
    <section className="overflow-hidden rounded-2xl border border-amber-300/30 bg-gradient-to-br from-amber-400/15 via-amber-400/5 to-transparent p-4">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-400/20 text-amber-300">
          <AlarmClock className="h-4.5 w-4.5" strokeWidth={2.25} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-white">Abriu uma vaga pra você!</h3>
          <p className="text-xs text-white/60">Alguém desistiu — aceite antes do prazo ou ela passa pra próxima pessoa.</p>
        </div>
        {label !== undefined && (
          <span className="shrink-0 rounded-full bg-amber-400/20 px-2.5 py-1 text-sm font-black tabular-nums text-amber-200">
            {label}
          </span>
        )}
      </div>
      <div className="mt-3 flex gap-2">
        <ActionForm action={acceptAction} successMessage="Vaga confirmada! Bom racha 🏐" className="flex-1">
          <input type="hidden" name="eventId" value={eventId} />
          <button
            type="submit"
            className="flex min-h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-500 text-sm font-bold text-white hover:bg-emerald-400"
          >
            <Check className="h-4 w-4" strokeWidth={2.5} />
            Aceitar vaga
          </button>
        </ActionForm>
        <ActionForm action={declineAction} successMessage="Tudo bem, a vaga passou pra próxima pessoa." className="flex-1">
          <input type="hidden" name="eventId" value={eventId} />
          <button
            type="submit"
            className="flex min-h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/5 text-sm font-semibold text-white/80 hover:bg-white/10"
          >
            <X className="h-4 w-4" strokeWidth={2.25} />
            Recusar
          </button>
        </ActionForm>
      </div>
    </section>
  );
}
