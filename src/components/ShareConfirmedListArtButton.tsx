"use client";

import { useState } from "react";
import { Download, ImageIcon, Loader2, Share2 } from "lucide-react";
import { useToast } from "./Toast";

async function fetchConfirmedListImage(eventId: string) {
  const response = await fetch(`/racha/${eventId}/confirmar/imagem`, { cache: "no-store" });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Não foi possível gerar a arte dos confirmados.");
  }
  return response.blob();
}

function downloadBlob(blob: Blob, eventDate: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `confirmados-racha-${eventDate}.png`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function ShareConfirmedListArtButton({ eventId, eventDate }: { eventId: string; eventDate: string }) {
  const [busyAction, setBusyAction] = useState<"share" | "download" | null>(null);
  const { showToast } = useToast();

  async function handleShare() {
    setBusyAction("share");
    try {
      const blob = await fetchConfirmedListImage(eventId);
      const file = new File([blob], `confirmados-racha-${eventDate}.png`, { type: "image/png" });
      const shareData = {
        title: "Lista de confirmados",
        text: "Lista confirmada pro próximo racha! 🏐",
        files: [file],
      };

      if (navigator.share && (!navigator.canShare || navigator.canShare(shareData))) {
        await navigator.share(shareData);
      } else {
        downloadBlob(blob, eventDate);
        showToast("Arte baixada! Agora é só postar nos Stories.");
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
      downloadBlob(await fetchConfirmedListImage(eventId), eventDate);
      showToast("Arte dos confirmados baixada!");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Não foi possível baixar a arte.");
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <section className="rounded-xl border border-purple-300/20 bg-gradient-to-br from-brand-purple/15 to-transparent p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-purple/20 text-purple-200">
          <ImageIcon className="h-5 w-5" strokeWidth={2} />
        </span>
        <div>
          <h2 className="font-semibold text-white">Arte dos confirmados para Stories</h2>
          <p className="mt-0.5 text-sm text-white/55">Gere a lista vertical com fotos, nomes, data e local do racha.</p>
        </div>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={handleShare}
          disabled={busyAction !== null}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-purple px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-purple-dark disabled:opacity-60"
        >
          {busyAction === "share" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
          Gerar e compartilhar
        </button>
        <button
          type="button"
          onClick={handleDownload}
          disabled={busyAction !== null}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-60"
        >
          {busyAction === "download" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Baixar imagem
        </button>
      </div>
    </section>
  );
}
