"use client";

import { useState } from "react";
import { Share2, Check } from "lucide-react";
import { useToast } from "./Toast";

export function ShareWhatsAppButton({ text, className }: { text: string; className?: string }) {
  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);

  function handleClick() {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(true);
        showToast("Copiado! Agora é só colar no grupo do zap.");
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {
        showToast("Não foi possível copiar. Tenta de novo.");
      });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={
        className ??
        "inline-flex items-center gap-1.5 rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-1.5 text-sm font-medium text-green-300 hover:bg-green-500/20"
      }
    >
      {copied ? <Check className="h-4 w-4" strokeWidth={2} /> : <Share2 className="h-4 w-4" strokeWidth={2} />}
      Compartilhar no WhatsApp
    </button>
  );
}
