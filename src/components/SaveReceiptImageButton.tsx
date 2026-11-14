"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { useToast } from "./Toast";
import { shareImageOrSave } from "@/lib/clientImageShare";

/** Gera a imagem do comprovante "Minha vaga" e abre o compartilhar do celular (ou baixa, no computador). */
export function SaveReceiptImageButton({ eventId }: { eventId: string }) {
  const [busy, setBusy] = useState(false);
  const { showToast } = useToast();

  async function handleClick() {
    setBusy(true);
    try {
      const response = await fetch(`/racha/${eventId}/minha-vaga/imagem`, { cache: "no-store" });
      if (!response.ok) throw new Error((await response.text()) || "Não foi possível gerar a imagem.");
      const result = await shareImageOrSave({
        blob: await response.blob(),
        filename: "minha-vaga-volei-por-amor.png",
        title: "Minha vaga — Vôlei Por Amor",
        text: "Vaga garantida no racha! 🏐💜",
      });
      if (result === "saved") showToast("Imagem salva no aparelho!");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Não foi possível gerar a imagem.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-emerald-200/30 bg-emerald-400/15 px-3 text-xs font-bold text-emerald-50 hover:bg-emerald-400/25 disabled:opacity-60"
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Download className="h-3.5 w-3.5" aria-hidden />}
      {busy ? "Gerando..." : "Salvar imagem"}
    </button>
  );
}
