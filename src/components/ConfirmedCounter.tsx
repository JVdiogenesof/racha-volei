"use client";

import { useCallback, useEffect, useState } from "react";
import { Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function ConfirmedCounter({
  eventId,
  maxPlayers: initialMaxPlayers,
  initialConfirmedCount,
  newcomerReservedSpots: initialNewcomerReservedSpots,
  initialNewcomerConfirmedCount,
  compact = false,
}: {
  eventId: string;
  maxPlayers: number | null;
  initialConfirmedCount: number;
  newcomerReservedSpots: number;
  initialNewcomerConfirmedCount: number;
  compact?: boolean;
}) {
  const [count, setCount] = useState(initialConfirmedCount);
  const [maxPlayers, setMaxPlayers] = useState(initialMaxPlayers);
  const [newcomerReservedSpots, setNewcomerReservedSpots] = useState(initialNewcomerReservedSpots);
  const [newcomerConfirmedCount, setNewcomerConfirmedCount] = useState(initialNewcomerConfirmedCount);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const [{ count: fresh }, { count: freshNewcomers }, { data: eventRow }] = await Promise.all([
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
        .eq("uses_newcomer_spot", true),
      supabase.from("events").select("max_players, newcomer_reserved_spots").eq("id", eventId).maybeSingle(),
    ]);
    if (fresh != null) setCount(fresh);
    if (freshNewcomers != null) setNewcomerConfirmedCount(freshNewcomers);
    if (eventRow) {
      setMaxPlayers(eventRow.max_players);
      setNewcomerReservedSpots(eventRow.newcomer_reserved_spots ?? 0);
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

  const memberCapacity = maxPlayers != null ? Math.max(0, maxPlayers - newcomerReservedSpots) : null;
  const regularConfirmedCount = Math.max(0, count - newcomerConfirmedCount);
  const memberSlotsRemaining = memberCapacity != null ? Math.max(0, memberCapacity - regularConfirmedCount) : null;
  const newcomerSlotsRemaining = Math.max(0, newcomerReservedSpots - newcomerConfirmedCount);
  const totalSlotsRemaining = maxPlayers != null ? Math.max(0, maxPlayers - count) : null;
  const isFull = totalSlotsRemaining === 0;
  const pct = maxPlayers ? Math.min(100, Math.round((count / maxPlayers) * 100)) : null;

  if (compact) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-white">
            <Users className="h-4 w-4 text-purple-300" />
            {count}{maxPlayers != null ? `/${maxPlayers}` : ""} confirmados
          </p>
          {memberSlotsRemaining !== null && <span className={`text-xs font-semibold ${memberSlotsRemaining === 0 ? "text-red-300" : "text-green-300"}`}>{memberSlotsRemaining === 0 ? "Membros preenchidos" : `${memberSlotsRemaining} vaga${memberSlotsRemaining === 1 ? "" : "s"} para membros`}</span>}
        </div>
        {newcomerReservedSpots > 0 && memberCapacity !== null && (
          <p className="mt-1 text-[11px] text-white/45">Membros {regularConfirmedCount}/{memberCapacity} · Convidados {newcomerConfirmedCount}/{newcomerReservedSpots}</p>
        )}
        {pct !== null && <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/10"><div className={`h-full rounded-full ${isFull ? "bg-red-400" : "bg-brand-purple"}`} style={{ width: `${pct}%` }} /></div>}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-medium text-white">
          <Users className="h-4 w-4 text-purple-300" strokeWidth={2} />
          {count} confirmado{count === 1 ? "" : "s"}
          {maxPlayers != null && <span className="text-white/50"> de {maxPlayers} vagas</span>}
        </p>
        {memberSlotsRemaining !== null && (
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
              memberSlotsRemaining === 0 ? "bg-red-500/15 text-red-300" : "bg-green-500/15 text-green-300"
            }`}
          >
            {memberSlotsRemaining === 0
              ? "Vagas de membros preenchidas"
              : `${memberSlotsRemaining} vaga${memberSlotsRemaining === 1 ? "" : "s"} para membros`}
          </span>
        )}
      </div>
      {newcomerReservedSpots > 0 && memberCapacity !== null && (
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg bg-white/5 px-3 py-2 text-white/65">
            <span className="block font-semibold text-white">Membros</span>
            {regularConfirmedCount} de {memberCapacity} · {memberSlotsRemaining} restante{memberSlotsRemaining === 1 ? "" : "s"}
          </div>
          <div className="rounded-lg border border-cyan-300/15 bg-cyan-400/10 px-3 py-2 text-cyan-100/70">
            <span className="block font-semibold text-cyan-100">Convidados</span>
            {newcomerConfirmedCount} de {newcomerReservedSpots} · {newcomerSlotsRemaining} restante{newcomerSlotsRemaining === 1 ? "" : "s"}
          </div>
        </div>
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
