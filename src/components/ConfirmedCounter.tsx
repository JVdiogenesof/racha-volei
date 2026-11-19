"use client";

import { useEffect, useState } from "react";
import { Users, Volleyball } from "lucide-react";
import { useLiveSpots } from "@/lib/useLiveSpots";
import { setterSpotsFor } from "@/lib/rachaSpots";

export function ConfirmedCounter({
  eventId,
  maxPlayers: initialMaxPlayers,
  initialConfirmedCount,
  initialSetterCount = 0,
  firstBatchSpots: initialFirstBatchSpots = null,
  secondBatchOpensAt: initialSecondBatchOpensAt = null,
  compact = false,
  showFullCapacity = false,
}: {
  eventId: string;
  maxPlayers: number | null;
  initialConfirmedCount: number;
  initialSetterCount?: number;
  /** Lotes: até secondBatchOpensAt o público só vê as vagas do Lote 1. */
  firstBatchSpots?: number | null;
  secondBatchOpensAt?: string | null;
  compact?: boolean;
  /** Organizadores acompanham a ocupação completa; participantes só veem as últimas vagas. */
  showFullCapacity?: boolean;
}) {
  const live = useLiveSpots(eventId);
  const [tick, setTick] = useState(() => Date.now());

  // Relógio do servidor: celular com a hora errada não pode antecipar nem atrasar o Lote 2.
  useEffect(() => {
    const interval = setInterval(() => setTick(Date.now()), 5000);
    return () => clearInterval(interval);
  }, []);
  const now = tick + (live?.clockOffset ?? 0);

  const count = live?.confirmed ?? initialConfirmedCount;
  const setterCount = live?.confirmedSetters ?? initialSetterCount;
  // Pix em andamento já segura a vaga: para quem chega agora ela não está livre.
  const reserved = live?.reserved ?? 0;
  const maxPlayers = live?.capacity ?? initialMaxPlayers;
  const firstBatchSpots = live ? live.firstBatchSpots : initialFirstBatchSpots;
  const secondBatchOpensAt = live ? live.secondBatchOpensAt : initialSecondBatchOpensAt;

  // Enquanto o Lote 2 não abre, o público enxerga só as vagas do Lote 1.
  const batchActive = firstBatchSpots != null && maxPlayers != null && secondBatchOpensAt != null && new Date(secondBatchOpensAt).getTime() > now;
  const visibleMax = batchActive && !showFullCapacity ? Math.min(firstBatchSpots, maxPlayers) : maxPlayers;
  const totalSlotsRemaining = visibleMax != null ? Math.max(0, visibleMax - count - reserved) : null;
  const setterCapacity = maxPlayers != null ? setterSpotsFor(maxPlayers) : null;
  const isFull = totalSlotsRemaining === 0;
  const shouldShowAvailability =
    totalSlotsRemaining !== null && (showFullCapacity || totalSlotsRemaining <= 10);
  const pct = visibleMax ? Math.min(100, Math.round(((count + reserved) / visibleMax) * 100)) : null;

  if (compact) {
    return (
      <div>
        <div className="mb-1.5 flex items-center justify-between gap-2 text-[11px] text-white/60">
          <span className="flex items-center gap-1.5 font-medium">
            <Users className="h-3.5 w-3.5 text-purple-300" strokeWidth={2.25} />
            Lista confirmada
          </span>
          <span className="flex items-center gap-2">
            {shouldShowAvailability && <span className={`font-semibold ${isFull ? "text-red-300" : "text-green-300"}`}>{isFull ? (batchActive && !showFullCapacity ? "Lote 1 completo" : "Lista completa") : `${totalSlotsRemaining} vaga${totalSlotsRemaining === 1 ? "" : "s"} livre${totalSlotsRemaining === 1 ? "" : "s"}`}</span>}
            <b className="tabular-nums text-white">{count}{showFullCapacity && maxPlayers != null ? ` / ${maxPlayers}` : ""}</b>
          </span>
        </div>
        {setterCapacity !== null && (
          <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-medium text-cyan-200/85">
            <Volleyball className="h-3 w-3" strokeWidth={2.25} />
            Levantadores: {setterCount}/{setterCapacity}
          </p>
        )}
        {pct !== null && <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10" role="img" aria-label={showFullCapacity || shouldShowAvailability ? `${count} de ${visibleMax} vagas preenchidas` : "Andamento da lista"}><div className={`h-full rounded-full transition-all ${isFull ? "bg-red-400" : "bg-gradient-to-r from-violet-400 to-purple-300"}`} style={{ width: `${pct}%` }} /></div>}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-medium text-white">
          <Users className="h-4 w-4 text-purple-300" strokeWidth={2} />
          {count} confirmado{count === 1 ? "" : "s"}
          {showFullCapacity && maxPlayers != null && <span className="text-white/50"> de {maxPlayers} vagas</span>}
        </p>
        {shouldShowAvailability && (
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
              isFull ? "bg-red-500/15 text-red-300" : "bg-green-500/15 text-green-300"
            }`}
          >
            {isFull
              ? (batchActive && !showFullCapacity ? "Lote 1 completo" : "Lista completa")
              : `${totalSlotsRemaining} vaga${totalSlotsRemaining === 1 ? "" : "s"} livre${totalSlotsRemaining === 1 ? "" : "s"}`}
          </span>
        )}
      </div>
      {reserved > 0 && (
        <p className="mt-1 text-xs text-amber-200/80">
          {reserved} {reserved === 1 ? "vaga está sendo paga" : "vagas estão sendo pagas"} agora. Se o Pix não sair em 5 minutos, ela volta para a lista.
        </p>
      )}
      {setterCapacity !== null && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-cyan-200/85">
          <Volleyball className="h-3.5 w-3.5" strokeWidth={2.25} />
          Levantadores: <strong>{setterCount}/{setterCapacity}</strong>
          <span className="text-white/40">· vagas protegidas automaticamente</span>
        </p>
      )}
      {pct !== null && (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className={`h-full rounded-full transition-all ${isFull ? "bg-red-400" : "bg-brand-purple"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}
