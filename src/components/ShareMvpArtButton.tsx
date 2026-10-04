"use client";

import { Download, Loader2, Share2 } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/components/Toast";
import { saveImageBlob, shareImageOrSave } from "@/lib/clientImageShare";

async function fetchMvpArt(eventId: string) {
  const response = await fetch(`/racha/${eventId}/mvp/imagem`, { cache: "no-store" });
  if (!response.ok) throw new Error((await response.text()) || "Não foi possível gerar a arte dos destaques.");
  const blob = await response.blob();
  if (!blob.type.startsWith("image/")) throw new Error("A arte voltou em um formato inválido.");
  return blob;
}

export function ShareMvpArtButton({ eventId, eventDate }: { eventId: string; eventDate: string }) {
  const [busyAction, setBusyAction] = useState<"share" | "save" | null>(null);
  const { showToast } = useToast();
  const filename = `destaques-racha-${eventDate}.png`;

  async function handleShare() {
    setBusyAction("share");
    try {
      const result = await shareImageOrSave({
        blob: await fetchMvpArt(eventId),
        filename,
        title: "Destaques do racha",
        text: "Confira quem brilhou no racha! 🏆🏐💜",
      });
      if (result === "saved") showToast("Arte dos destaques salva no aparelho!");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Não foi possível compartilhar a arte dos destaques.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleSave() {
    setBusyAction("save");
    try {
      saveImageBlob(await fetchMvpArt(eventId), filename);
      showToast("Arte dos destaques salva no aparelho!");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Não foi possível salvar a arte dos destaques.");
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
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-purple px-4 py-3 font-semibold text-white transition hover:bg-brand-purple-dark disabled:opacity-60"
      >
        {busyAction === "share" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
        Compartilhar arte
      </button>
      <button
        type="button"
        onClick={handleSave}
        disabled={busyAction !== null}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-3 font-semibold text-white transition hover:bg-white/10 disabled:opacity-60"
      >
        {busyAction === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        Salvar na galeria
      </button>
    </div>
  );
}
