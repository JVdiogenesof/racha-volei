"use client";

import { type ReactNode, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

const noopSubscribe = () => () => {};

/**
 * Renderiza conteúdo fixo na tela direto no <body>. Dentro do conteúdo da página
 * há ancestrais com transform/animação (PageTransition), e no iOS Safari um
 * `position: fixed` dentro deles passa a ser posicionado em relação a esse
 * ancestral — a barra "sobe" e fica no meio da tela.
 */
export function useBodyPortalReady() {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

export function FloatingDock({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ready = useBodyPortalReady();
  if (!ready) return null;
  return createPortal(
    <div
      className={`fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom))] left-1/2 z-40 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-white/15 bg-[#171122]/95 p-1.5 shadow-2xl shadow-black/60 backdrop-blur-xl ${className}`}
    >
      {children}
    </div>,
    document.body,
  );
}
