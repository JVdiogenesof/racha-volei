"use client";

import { useCallback, useEffect, useState } from "react";
import { Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function ConfirmedCounter({
  eventId,
  maxPlayers: initialMaxPlayers,
  initialConfirmedCount,
}: {
  eventId: string;
  maxPlayers: number | null;
  initialConfirmedCount: number;
}) {
  const [count, setCount] = useState(initialConfirmedCount);
  const [maxPlayers, setMaxPlayers] = useState(initialMaxPlayers);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const [{ count: fresh }, { data: eventRow }] = await Promise.all([
      supabase
        .from("attendance")
        .select("id", { count: "exact", head: true })
        .eq("event_id", eventId)
        .eq("status", "confirmed"),
      supabase.from("events").select("max_players").eq("id", eventId).maybeSingle(),
    ]);
    if (fresh != null) setCount(fresh);
    if (eventRow) setMaxPlayers(eventRow.max_players);
  }, [eventId]);

  useEffect(() => {
    // Realtime (postgres_changes) exige que o token do usuário chegue até o
    // websocket pra passar pela RLS — em teste ao vivo isso não disparou de
    // forma confiável. Poll simples é mais robusto pra esse caso de uso (o
    // número não precisa mudar no milissegundo exato em que alguém confirma).
    const interval = setInterval(refresh, 10000);
    return () => clearInterval(interval);
  }, [refresh]);

  const vagasRestantes = maxPlayers != null ? Math.max(0, maxPlayers - count) : null;
  const isFull = vagasRestantes === 0;
  const pct = maxPlayers ? Math.min(100, Math.round((count / maxPlayers) * 100)) : null;

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-medium text-white">
          <Users className="h-4 w-4 text-purple-300" strokeWidth={2} />
          {count} confirmado{count === 1 ? "" : "s"}
          {maxPlayers != null && <span className="text-white/50"> de {maxPlayers} vagas</span>}
        </p>
        {vagasRestantes !== null && (
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
              isFull ? "bg-red-500/15 text-red-300" : "bg-green-500/15 text-green-300"
            }`}
          >
            {isFull ? "Lista cheia" : `Faltam ${vagasRestantes}`}
          </span>
        )}
      </div>
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
