"use client";

import { useEffect } from "react";

/**
 * No iPhone (principalmente no app instalado), depois que o teclado fecha ou
 * que o app volta do segundo plano, o Safari às vezes deixa os elementos fixos
 * (barra de navegação e barras flutuantes) presos onde o teclado estava, no meio
 * da tela. Um empurrãozinho de 1px no scroll, e a volta ao lugar, faz o Safari
 * recalcular a área visível e recolocar tudo embaixo.
 */
export function ViewportRecovery() {
  useEffect(() => {
    const viewport = window.visualViewport;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let keyboardWasOpen = false;

    function nudge() {
      const x = window.scrollX;
      const y = window.scrollY;
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      if (maxScroll <= 0) return;
      const away = y >= maxScroll ? y - 1 : y + 1;
      window.scrollTo({ left: x, top: away, behavior: "instant" });
      window.scrollTo({ left: x, top: y, behavior: "instant" });
    }

    function schedule(delay = 250) {
      if (timer) clearTimeout(timer);
      timer = setTimeout(nudge, delay);
    }

    function onFocusOut(event: FocusEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.matches?.("input, textarea, select, [contenteditable='true']")) schedule(350);
    }

    function onViewportResize() {
      if (!viewport) return;
      const keyboardOpen = viewport.height < window.innerHeight - 120;
      if (keyboardWasOpen && !keyboardOpen) schedule(150);
      keyboardWasOpen = keyboardOpen;
    }

    function onVisible() {
      if (document.visibilityState === "visible") schedule(200);
    }

    document.addEventListener("focusout", onFocusOut);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onVisible);
    viewport?.addEventListener("resize", onViewportResize);
    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener("focusout", onFocusOut);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onVisible);
      viewport?.removeEventListener("resize", onViewportResize);
    };
  }, []);

  return null;
}
