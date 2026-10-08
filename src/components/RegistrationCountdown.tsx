"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlarmClock } from "lucide-react";

type Remaining = { days: number; hours: number; minutes: number; seconds: number };

function remainingUntil(opensAt: string): Remaining | null {
  const remaining = new Date(opensAt).getTime() - Date.now();
  if (remaining <= 0) return null;
  const totalSeconds = Math.floor(remaining / 1_000);
  return {
    days: Math.floor(totalSeconds / 86_400),
    hours: Math.floor((totalSeconds % 86_400) / 3_600),
    minutes: Math.floor((totalSeconds % 3_600) / 60),
    seconds: totalSeconds % 60,
  };
}

export function RegistrationCountdown({ opensAt, compact = false }: { opensAt: string; compact?: boolean }) {
  const router = useRouter();
  const [remaining, setRemaining] = useState<Remaining | null | undefined>(undefined);

  useEffect(() => {
    let refreshed = false;
    const update = () => {
      const next = remainingUntil(opensAt);
      setRemaining(next);
      if (!next && !refreshed) {
        refreshed = true;
        router.refresh();
      }
    };
    update();
    const interval = window.setInterval(update, 1_000);
    return () => window.clearInterval(interval);
  }, [opensAt, router]);

  if (remaining === undefined) return <div className={`${compact ? "h-20" : "h-28"} animate-pulse rounded-2xl bg-white/5`} aria-hidden="true" />;
  if (remaining === null) return null;

  const units = [
    { value: remaining.days, label: "dias" },
    { value: remaining.hours, label: "horas" },
    { value: remaining.minutes, label: "min" },
    { value: remaining.seconds, label: "seg" },
  ];

  return (
    <section className={`overflow-hidden rounded-2xl border border-fuchsia-300/25 bg-gradient-to-br from-fuchsia-500/15 via-purple-500/10 to-transparent ${compact ? "p-3" : "p-4"}`} aria-label="Contagem regressiva para abertura das inscrições">
      <p className="flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-fuchsia-100/80">
        <AlarmClock className="h-4 w-4" strokeWidth={2} />
        Inscrições abrem em
      </p>
      <div className={`mt-3 grid grid-cols-4 ${compact ? "gap-1.5" : "gap-2"}`} aria-live="polite">
        {units.map((unit) => (
          <div key={unit.label} className="rounded-xl border border-white/8 bg-black/15 px-1.5 py-2 text-center">
            <strong className={`${compact ? "text-lg" : "text-2xl"} block leading-none text-white`}>{String(unit.value).padStart(2, "0")}</strong>
            <span className="mt-1 block text-[9px] font-semibold uppercase tracking-wide text-white/40">{unit.label}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-center text-xs text-white/45">Prepare-se: o botão para colocar o nome libera sozinho.</p>
    </section>
  );
}
