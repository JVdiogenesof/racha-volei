"use client";

import { Download, Loader2, Share2, Trophy } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/components/Toast";
import { saveImageBlob, shareImageOrSave } from "@/lib/clientImageShare";

async function fetchFinalResultArt(eventId: string) {
  const response = await fetch(`/racha/${eventId}/resultado/imagem`, { cache: "no-store" });
  if (!response.ok) throw new Error((await response.text()) || "Não foi possível gerar a arte do resultado.");
  const blob = await response.blob();
  if (!blob.type.startsWith("image/")) throw new Error("A arte do resultado voltou em um formato inválido.");
  return blob;
}

export function ShareFinalResultArtButton({ eventId, eventDate }: { eventId: string; eventDate: string }) {
  const [busyAction, setBusyAction] = useState<"share" | "save" | null>(null);
  const { showToast } = useToast();
  const filename = `resultado-final-${eventDate}.png`;

  async function handleShare() {
    setBusyAction("share");
    try {
      const result = await shareImageOrSave({
        blob: await fetchFinalResultArt(eventId),
        filename,
        title: "Resultado final do racha",
        text: "O pódio do racha está definido! 🏆💜",
      });
      if (result === "saved") showToast("Arte do resultado salva no aparelho!");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Não foi possível compartilhar a arte do resultado.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleSave() {
    setBusyAction("save");
    try {
      saveImageBlob(await fetchFinalResultArt(eventId), filename);
      showToast("Arte do resultado salva no aparelho!");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Não foi possível salvar a arte do resultado.");
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <div className="mt-5 flex flex-wrap justify-center gap-2">
      <button type="button" onClick={handleShare} disabled={busyAction !== null} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-bold text-amber-950 transition hover:bg-amber-300 active:scale-[0.98] disabled:opacity-60">
        {busyAction === "share" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trophy className="h-4 w-4" />}
        Compartilhar pódio
      </button>
      <button type="button" onClick={handleSave} disabled={busyAction !== null} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/15 active:scale-[0.98] disabled:opacity-60">
        {busyAction === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        Salvar arte
      </button>
    </div>
  );
}
