"use client";

import { Download, Loader2, Share2 } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/components/Toast";
import { saveImageBlob, shareImageOrSave } from "@/lib/clientImageShare";

async function fetchTeamsArt(eventId: string) {
  const response = await fetch(`/racha/${eventId}/times/imagem`, { cache: "no-store" });
  if (!response.ok) throw new Error((await response.text()) || "Não foi possível gerar a arte dos times.");
  const blob = await response.blob();
  if (!blob.type.startsWith("image/")) throw new Error("A arte dos times voltou em um formato inválido.");
  return blob;
}

export function ShareTeamsArtButton({ eventId, eventDate }: { eventId: string; eventDate: string }) {
  const [busyAction, setBusyAction] = useState<"share" | "save" | null>(null);
  const { showToast } = useToast();
  const filename = `times-racha-${eventDate}.png`;

  async function handleShare() {
    setBusyAction("share");
    try {
      const result = await shareImageOrSave({
        blob: await fetchTeamsArt(eventId),
        filename,
        title: "Times do racha",
        text: "Os times do próximo racha estão prontos! 🏐💜",
      });
      if (result === "saved") showToast("Arte dos times salva no aparelho!");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Não foi possível compartilhar a arte dos times.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleSave() {
    setBusyAction("save");
    try {
      saveImageBlob(await fetchTeamsArt(eventId), filename);
      showToast("Arte dos times salva no aparelho!");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Não foi possível salvar a arte dos times.");
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={handleShare} disabled={busyAction !== null} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-brand-purple px-3 py-2 text-sm font-semibold text-white hover:bg-brand-purple-dark disabled:opacity-60">
        {busyAction === "share" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
        Compartilhar times
      </button>
      <button type="button" onClick={handleSave} disabled={busyAction !== null} aria-label="Salvar arte dos times na galeria" title="Salvar arte dos times na galeria" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-white/80 hover:bg-white/10 hover:text-white disabled:opacity-60">
        {busyAction === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        <span className="sm:hidden">Salvar</span><span className="hidden sm:inline">Salvar arte</span>
      </button>
    </div>
  );
}
