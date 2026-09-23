"use client";

import { useState } from "react";
import { Download, Loader2, Share2 } from "lucide-react";
import { useToast } from "@/components/Toast";

async function fetchSummaryImage(eventId: string) {
  const response = await fetch(`/racha/${eventId}/resumo/imagem`, { cache: "no-store" });
  if (!response.ok) throw new Error("Não foi possível gerar a arte.");
  return response.blob();
}

function downloadBlob(blob: Blob, eventDate: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `resumo-racha-${eventDate}.png`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function ShareRachaSummaryButton({ eventId, eventDate }: { eventId: string; eventDate: string }) {
  const [busyAction, setBusyAction] = useState<"share" | "download" | null>(null);
  const { showToast } = useToast();

  async function handleShare() {
    setBusyAction("share");
    try {
      const blob = await fetchSummaryImage(eventId);
      const file = new File([blob], `resumo-racha-${eventDate}.png`, { type: "image/png" });
      const shareData = {
        title: "Resumo do racha",
        text: "Confira quem mandou bem no racha! 🏐",
        files: [file],
      };

      if (navigator.share && (!navigator.canShare || navigator.canShare(shareData))) {
        await navigator.share(shareData);
      } else {
        downloadBlob(blob, eventDate);
        showToast("Arte baixada! Agora é só enviar ou postar.");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      showToast(error instanceof Error ? error.message : "Não foi possível compartilhar a arte.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleDownload() {
    setBusyAction("download");
    try {
      downloadBlob(await fetchSummaryImage(eventId), eventDate);
      showToast("Arte baixada com sucesso!");
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
        Baixar imagem
      </button>
    </div>
  );
}
