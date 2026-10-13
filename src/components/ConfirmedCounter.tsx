"use client";

import { useCallback, useEffect, useState } from "react";
import { Users, Volleyball } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function ConfirmedCounter({
  eventId,
  maxPlayers: initialMaxPlayers,
  initialConfirmedCount,
  initialSetterCount = 0,
  compact = false,
  showFullCapacity = false,
}: {
  eventId: string;
  maxPlayers: number | null;
  initialConfirmedCount: number;
  initialSetterCount?: number;
  compact?: boolean;
  /** Organizadores acompanham a ocupação completa; participantes só veem as últimas vagas. */
  showFullCapacity?: boolean;
}) {
  const [count, setCount] = useState(initialConfirmedCount);
  const [setterCount, setSetterCount] = useState(initialSetterCount);
  const [maxPlayers, setMaxPlayers] = useState(initialMaxPlayers);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const [{ count: fresh }, { count: freshSetters }, { data: eventRow }] = await Promise.all([
      supabase
        .from("attendance")
        .select("id", { count: "exact", head: true })
        .eq("event_id", eventId)
        .eq("status", "confirmed"),
      supabase
        .from("attendance")
        .select("id", { count: "exact", head: true })
        .eq("event_id", eventId)
        .eq("status", "confirmed")
        .eq("uses_setter_spot", true),
      supabase.from("events").select("max_players").eq("id", eventId).maybeSingle(),
    ]);
    if (fresh != null) setCount(fresh);
    if (freshSetters != null) setSetterCount(freshSetters);
    if (eventRow) {
      setMaxPlayers(eventRow.max_players);
    }
  }, [eventId]);

  useEffect(() => {
    // Realtime (postgres_changes) exige que o token do usuário chegue até o
    // websocket pra passar pela RLS — em teste ao vivo isso não disparou de
    // forma confiável. Poll simples é mais robusto pra esse caso de uso (o
    // número não precisa mudar no milissegundo exato em que alguém confirma).
    const interval = setInterval(refresh, 10000);
    return () => clearInterval(interval);
  }, [refresh]);

  const totalSlotsRemaining = maxPlayers != null ? Math.max(0, maxPlayers - count) : null;
  const setterCapacity = maxPlayers != null ? Math.max(1, Math.ceil(maxPlayers / 6)) : null;
  const isFull = totalSlotsRemaining === 0;
  const shouldShowAvailability =
    totalSlotsRemaining !== null && (showFullCapacity || totalSlotsRemaining <= 10);
  const pct = maxPlayers ? Math.min(100, Math.round((count / maxPlayers) * 100)) : null;

  if (compact) {
    return (
      <div>
        <div className="mb-1.5 flex items-center justify-between gap-2 text-[11px] text-white/60">
          <span className="flex items-center gap-1.5 font-medium">
            <Users className="h-3.5 w-3.5 text-purple-300" strokeWidth={2.25} />
            Lista confirmada
          </span>
          <span className="flex items-center gap-2">
            {shouldShowAvailability && <span className={`font-semibold ${isFull ? "text-red-300" : "text-green-300"}`}>{isFull ? "Lista completa" : `${totalSlotsRemaining} vaga${totalSlotsRemaining === 1 ? "" : "s"} livre${totalSlotsRemaining === 1 ? "" : "s"}`}</span>}
            <b className="tabular-nums text-white">{count}{showFullCapacity && maxPlayers != null ? ` / ${maxPlayers}` : ""}</b>
          </span>
        </div>
        {setterCapacity !== null && (
          <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-medium text-cyan-200/85">
            <Volleyball className="h-3 w-3" strokeWidth={2.25} />
            Levantadores: {setterCount}/{setterCapacity}
          </p>
        )}
        {pct !== null && <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10" role="img" aria-label={showFullCapacity || shouldShowAvailability ? `${count} de ${maxPlayers} vagas preenchidas` : "Andamento da lista"}><div className={`h-full rounded-full transition-all ${isFull ? "bg-red-400" : "bg-gradient-to-r from-violet-400 to-purple-300"}`} style={{ width: `${pct}%` }} /></div>}
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
              ? "Lista completa"
              : `${totalSlotsRemaining} vaga${totalSlotsRemaining === 1 ? "" : "s"} livre${totalSlotsRemaining === 1 ? "" : "s"}`}
          </span>
        )}
      </div>
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
