"use client";

import { useEffect } from "react";

/**
 * Sem isso, o Safari/iOS e alguns navegadores mobile simplesmente ignoram
 * o CSS :active em toda a página (é um comportamento documentado do WebKit:
 * :active só funciona se existir algum listener de touchstart no documento).
 * Esse componente só existe pra registrar esse listener e "ligar" o feedback
 * visual de clique em todo botão/link/ícone do site em celulares.
 */
export function TouchActiveFix() {
  useEffect(() => {
    const noop = () => {};
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const showPress = (event: PointerEvent) => {
      const element = (event.target as Element | null)?.closest<HTMLElement>("button:not(:disabled), a[href], [role='button']");
      if (!element) return;
      element.classList.remove("tap-feedback-active");
      // Reinicia a animação mesmo em dois toques seguidos no mesmo controle.
      void element.offsetWidth;
      element.classList.add("tap-feedback-active");
      const timer = setTimeout(() => {
        element.classList.remove("tap-feedback-active");
        timers.delete(timer);
      }, 360);
      timers.add(timer);
    };
    document.addEventListener("touchstart", noop, { passive: true });
    document.addEventListener("pointerdown", showPress, { passive: true });
    return () => {
      document.removeEventListener("touchstart", noop);
      document.removeEventListener("pointerdown", showPress);
      timers.forEach(clearTimeout);
    };
  }, []);

  return null;
}
