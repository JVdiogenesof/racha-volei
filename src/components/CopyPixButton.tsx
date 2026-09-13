"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { useToast } from "./Toast";

export function CopyPixButton({ pixKey, className }: { pixKey: string; className?: string }) {
  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);

  function handleClick() {
    navigator.clipboard
      .writeText(pixKey)
      .then(() => {
        setCopied(true);
        showToast("Chave Pix copiada!");
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
        "inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/10"
      }
    >
      {copied ? <Check className="h-4 w-4 text-green-400" strokeWidth={2} /> : <Copy className="h-4 w-4" strokeWidth={2} />}
      Copiar chave Pix
    </button>
  );
}
