"use client";

import { useEffect, useState } from "react";
import { Timer } from "lucide-react";

type Countdown = { days: number; hours: number; minutes: number };

function getCountdown(startIso: string): Countdown | null {
  const remaining = new Date(startIso).getTime() - Date.now();
  if (remaining <= 0) return null;

  const totalMinutes = Math.floor(remaining / 60_000);
  return {
    days: Math.floor(totalMinutes / 1_440),
    hours: Math.floor((totalMinutes % 1_440) / 60),
    minutes: totalMinutes % 60,
  };
}

export function EventCountdown({ startIso, isInProgress }: { startIso: string; isInProgress: boolean }) {
  const [countdown, setCountdown] = useState<Countdown | null | undefined>(undefined);

  useEffect(() => {
    const update = () => setCountdown(getCountdown(startIso));
    update();
    const interval = window.setInterval(update, 30_000);
    return () => window.clearInterval(interval);
  }, [startIso]);

  if (isInProgress) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl border border-red-300/20 bg-red-400/10 px-4 py-3 text-sm font-semibold text-red-200">
        <span className="h-2 w-2 animate-pulse rounded-full bg-red-400" />
        O racha está rolando agora
      </div>
    );
  }

  if (countdown === undefined) {
    return <div className="h-[74px] animate-pulse rounded-xl bg-white/5" aria-hidden="true" />;
  }

  if (countdown === null) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl border border-purple-300/20 bg-purple-400/10 px-4 py-3 text-sm font-semibold text-purple-100">
        <Timer className="h-4 w-4" strokeWidth={2} />
        Começa em instantes
      </div>
    );
  }

  const units = [
    { value: countdown.days, label: "dias" },
    { value: countdown.hours, label: "horas" },
    { value: countdown.minutes, label: "min" },
  ];

  return (
    <div className="rounded-xl border border-white/10 bg-black/10 p-3">
      <p className="mb-2 flex items-center justify-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55">
        <Timer className="h-3.5 w-3.5" strokeWidth={2} />
        Começa em
      </p>
      <div className="grid grid-cols-3 gap-2" aria-live="polite">
        {units.map((unit) => (
          <div key={unit.label} className="rounded-lg bg-white/8 px-2 py-2 text-center">
            <strong className="block text-2xl leading-none text-white">{String(unit.value).padStart(2, "0")}</strong>
            <span className="mt-1 block text-[10px] uppercase tracking-wide text-white/45">{unit.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
