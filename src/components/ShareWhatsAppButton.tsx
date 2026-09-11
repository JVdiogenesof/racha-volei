"use client";

import { MessageCircle } from "lucide-react";

export function ShareWhatsAppButton({
  message,
  path,
  className,
}: {
  /** Texto da mensagem, sem o link (o link é montado e anexado na hora do clique). */
  message: string;
  /** Caminho da página a compartilhar, ex: `/racha/123/confirmar`. */
  path: string;
  className?: string;
}) {
  function handleClick() {
    const link = `${window.location.origin}${path}`;
    const text = `${message}\n${link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
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
      <MessageCircle className="h-4 w-4" strokeWidth={2} />
      Compartilhar no WhatsApp
    </button>
  );
}
