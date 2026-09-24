"use client";

import { useState } from "react";
import { Download, Loader2, Share2 } from "lucide-react";
import { useToast } from "@/components/Toast";
import { saveImageBlob, shareImageOrSave } from "@/lib/clientImageShare";

async function fetchSummaryImage(eventId: string) {
  const response = await fetch(`/racha/${eventId}/resumo/imagem`, { cache: "no-store" });
  if (!response.ok) throw new Error((await response.text()) || "Não foi possível gerar a arte.");
  return response.blob();
}

export function ShareRachaSummaryButton({ eventId, eventDate }: { eventId: string; eventDate: string }) {
  const [busyAction, setBusyAction] = useState<"share" | "download" | null>(null);
  const { showToast } = useToast();

  async function handleShare() {
    setBusyAction("share");
    try {
      const blob = await fetchSummaryImage(eventId);
      const result = await shareImageOrSave({
        blob,
        filename: `resumo-racha-${eventDate}.png`,
        title: "Resumo do racha",
        text: "Confira quem mandou bem no racha! 🏐",
      });
      if (result === "saved") showToast("A arte foi salva no aparelho. Agora é só enviar ou postar.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Não foi possível compartilhar a arte.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleDownload() {
    setBusyAction("download");
    try {
      saveImageBlob(await fetchSummaryImage(eventId), `resumo-racha-${eventDate}.png`);
      showToast("Arte salva no aparelho!");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Não foi possível baixar a arte.");
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <button
        type="button"
        onClick={handleShare}
        disabled={busyAction !== null}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-purple px-5 py-3 font-semibold text-white hover:bg-brand-purple-dark disabled:opacity-60"
      >
        {busyAction === "share" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
        Compartilhar arte
      </button>
      <button
        type="button"
        onClick={handleDownload}
        disabled={busyAction !== null}
        className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 py-3 font-semibold text-white hover:bg-white/10 disabled:opacity-60"
      >
        {busyAction === "download" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        Salvar na galeria
      </button>
    </div>
  );
}
