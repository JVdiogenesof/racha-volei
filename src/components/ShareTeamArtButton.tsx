"use client";

import { Image as ImageIcon, Loader2 } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/components/Toast";
import { shareImageOrSave } from "@/lib/clientImageShare";

export function ShareTeamArtButton({ eventId, teamId, teamName, mode }: { eventId: string; teamId: string; teamName: string; mode: "escalacao" | "resultado" }) {
  const [busy, setBusy] = useState(false);
  const { showToast } = useToast();
  const label = mode === "resultado" ? "Arte do resultado" : "Arte da escalação";

  async function handle() {
    setBusy(true);
    try {
      const response = await fetch(`/racha/${eventId}/times/arte/${teamId}?modo=${mode}`, { cache: "no-store" });
      if (!response.ok) throw new Error((await response.text()) || "Não foi possível gerar a arte.");
      const blob = await response.blob();
      if (!blob.type.startsWith("image/")) throw new Error("A arte voltou em um formato inválido.");
      const result = await shareImageOrSave({ blob, filename: `time-${teamName.toLowerCase().replace(/\s+/g, "-")}-${mode}.png`, title: `Time ${teamName}`, text: `Time ${teamName} 🏐💜` });
      if (result === "saved") showToast("Arte salva no aparelho!");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Não foi possível gerar a arte.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" onClick={handle} disabled={busy} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-white/12 bg-white/5 px-2.5 text-xs font-bold text-white/80 hover:bg-white/10 hover:text-white disabled:opacity-60">
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5" />}
      {label}
    </button>
  );
}
