"use client";

import { Download, Loader2, Share2, Swords } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/components/Toast";
import { saveImageBlob, shareImageOrSave } from "@/lib/clientImageShare";

async function fetchConfrontationsArt(eventId: string) {
  const response = await fetch(`/racha/${eventId}/times/confrontos/imagem`, { cache: "no-store" });
  if (!response.ok) throw new Error((await response.text()) || "Não foi possível gerar a arte dos confrontos.");
  const blob = await response.blob();
  if (!blob.type.startsWith("image/")) throw new Error("A arte dos confrontos voltou em um formato inválido.");
  return blob;
}

export function ShareConfrontationsArtButton({ eventId, eventDate, compact = false }: { eventId: string; eventDate: string; compact?: boolean }) {
  const [busyAction, setBusyAction] = useState<"share" | "save" | null>(null);
  const { showToast } = useToast();
  const filename = `confrontos-racha-${eventDate}.png`;

  async function handleShare() {
    setBusyAction("share");
    try {
      const result = await shareImageOrSave({
        blob: await fetchConfrontationsArt(eventId),
        filename,
        title: "Confrontos do racha",
        text: "A tabela de confrontos está pronta! 🏐💜",
      });
      if (result === "saved") showToast("Arte dos confrontos salva no aparelho!");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Não foi possível compartilhar a arte dos confrontos.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleSave() {
    setBusyAction("save");
    try {
      saveImageBlob(await fetchConfrontationsArt(eventId), filename);
      showToast("Arte dos confrontos salva no aparelho!");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Não foi possível salvar a arte dos confrontos.");
    } finally {
      setBusyAction(null);
    }
  }

  if (compact) {
    return (
      <div className="flex items-center gap-1.5">
        <button type="button" onClick={handleShare} disabled={busyAction !== null} aria-label="Compartilhar arte dos confrontos" title="Compartilhar arte dos confrontos" className="flex h-10 w-10 items-center justify-center rounded-full border border-purple-300/25 bg-purple-400/15 text-purple-100 transition hover:bg-purple-400/25 active:scale-95 disabled:opacity-60">
          {busyAction === "share" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
        </button>
        <button type="button" onClick={handleSave} disabled={busyAction !== null} aria-label="Salvar arte dos confrontos" title="Salvar arte dos confrontos" className="flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white active:scale-95 disabled:opacity-60">
          {busyAction === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={handleShare} disabled={busyAction !== null} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-brand-purple px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-purple-dark active:scale-[0.98] disabled:opacity-60">
        {busyAction === "share" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Swords className="h-4 w-4" />}
        Compartilhar confrontos
      </button>
      <button type="button" onClick={handleSave} disabled={busyAction !== null} aria-label="Salvar arte dos confrontos na galeria" title="Salvar arte dos confrontos na galeria" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/10 hover:text-white active:scale-[0.98] disabled:opacity-60">
        {busyAction === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        Salvar arte
      </button>
    </div>
  );
}
