"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type LiveSpots = {
  confirmed: number;
  confirmedSetters: number;
  /** Vagas seguradas por um Pix em andamento (reserva de 5 minutos). */
  reserved: number;
  reservedSetters: number;
  capacity: number | null;
  firstBatchSpots: number | null;
  secondBatchOpensAt: string | null;
  /** Diferença entre o relógio do servidor e o do aparelho. */
  clockOffset: number;
};

const POLL_MS = 4000;

type Entry = {
  data: LiveSpots | null;
  listeners: Set<(data: LiveSpots) => void>;
  timer: number | undefined;
  loading: boolean;
};

// Um só polling por racha, mesmo com vários componentes na tela.
const entries = new Map<string, Entry>();

async function load(eventId: string, entry: Entry) {
  if (entry.loading) return;
  entry.loading = true;
  try {
    const { data, error } = await createClient().rpc("event_spot_counts", { p_event_id: eventId });
    const row = Array.isArray(data) ? data[0] : data;
    if (error || !row) return;
    entry.data = {
      confirmed: row.confirmed_total,
      confirmedSetters: row.confirmed_setters,
      reserved: row.reserved_total,
      reservedSetters: row.reserved_setters,
      capacity: row.capacity,
      firstBatchSpots: row.first_batch_spots,
      secondBatchOpensAt: row.second_batch_opens_at,
      clockOffset: new Date(row.server_now).getTime() - Date.now(),
    };
    for (const listener of entry.listeners) listener(entry.data);
  } catch {
    // mantém o último valor bom; tenta de novo no próximo ciclo
  } finally {
    entry.loading = false;
  }
}

function schedule(eventId: string, entry: Entry) {
  window.clearTimeout(entry.timer);
  entry.timer = window.setTimeout(async () => {
    if (!document.hidden) await load(eventId, entry);
    if (entry.listeners.size) schedule(eventId, entry);
  }, POLL_MS);
}

function wake(eventId: string) {
  const entry = entries.get(eventId);
  if (!entry || document.hidden) return;
  void load(eventId, entry);
  schedule(eventId, entry);
}

/**
 * Vagas do racha ao vivo: lê a cada 4s com a tela aberta e na hora em que o
 * app volta do segundo plano, da rede ou do banco (voltar do app do banco).
 */
export function useLiveSpots(eventId: string | null): LiveSpots | null {
  const [data, setData] = useState<LiveSpots | null>(() => (eventId ? (entries.get(eventId)?.data ?? null) : null));

  useEffect(() => {
    if (!eventId) return;
    let entry = entries.get(eventId);
    if (!entry) {
      entry = { data: null, listeners: new Set(), timer: undefined, loading: false };
      entries.set(eventId, entry);
    }
    const listener = (next: LiveSpots) => setData(next);
    entry.listeners.add(listener);
    void load(eventId, entry);
    schedule(eventId, entry);

    const onWake = () => wake(eventId);
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("focus", onWake);
    window.addEventListener("online", onWake);
    window.addEventListener("pageshow", onWake);
    return () => {
      entry.listeners.delete(listener);
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("focus", onWake);
      window.removeEventListener("online", onWake);
      window.removeEventListener("pageshow", onWake);
      if (!entry.listeners.size) {
        window.clearTimeout(entry.timer);
        entries.delete(eventId);
      }
    };
  }, [eventId]);

  return data;
}
