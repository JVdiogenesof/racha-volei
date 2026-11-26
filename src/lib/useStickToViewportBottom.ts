"use client";

import { useEffect, type RefObject } from "react";

const TYPING = "input, textarea, select, [contenteditable='true']";

/**
 * Mantém um elemento `position: fixed` colado no fundo da área visível.
 *
 * No iPhone (Safari e app instalado), depois do teclado, da rolagem com a barra
 * do Safari encolhendo ou da volta do segundo plano, o navegador às vezes calcula
 * o "fundo da tela" errado e a barra fica parada no meio. Em vez de tentar forçar
 * o Safari a recalcular, aqui o próprio elemento mede onde está e onde deveria
 * estar (fundo do visualViewport menos a margem do CSS) e corrige o `bottom`
 * quando a diferença passa de alguns pixels. Em condições normais a diferença é
 * zero e nada é mexido. Enquanto alguém digita, fica no lugar padrão.
 */
export function useStickToViewportBottom(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const viewport = window.visualViewport;
    let shift = 0;
    let base = 0;
    let frame = 0;
    const timers = new Set<ReturnType<typeof setTimeout>>();

    function apply() {
      frame = 0;
      const el = ref.current;
      if (!el || !el.isConnected) return;
      if (!shift) base = parseFloat(getComputedStyle(el).bottom) || 0;
      const zoomed = viewport ? viewport.scale > 1.01 : false;
      const active = document.activeElement as HTMLElement | null;
      const typing = Boolean(active?.matches?.(TYPING));
      const viewBottom = viewport ? viewport.offsetTop + viewport.height : window.innerHeight;
      // Onde ficaria sem a correção atual.
      const naturalBottom = el.getBoundingClientRect().bottom - shift;
      let next = zoomed || typing ? 0 : Math.round(viewBottom - base - naturalBottom);
      if (Math.abs(next) < 3) next = 0;
      if (next === shift) return;
      shift = next;
      el.style.bottom = shift ? `${base - shift}px` : "";
    }

    function schedule() {
      if (!frame) frame = requestAnimationFrame(apply);
    }
    function later(delay: number) {
      const timer = setTimeout(() => {
        timers.delete(timer);
        schedule();
      }, delay);
      timers.add(timer);
    }
    function settle() {
      schedule();
      later(120);
      later(400);
      later(900);
    }
    function onVisible() {
      if (document.visibilityState === "visible") settle();
    }

    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", settle);
    window.addEventListener("orientationchange", settle);
    window.addEventListener("pageshow", settle);
    document.addEventListener("visibilitychange", onVisible);
    document.addEventListener("focusin", settle);
    document.addEventListener("focusout", settle);
    document.addEventListener("touchend", settle, { passive: true });
    viewport?.addEventListener("resize", settle);
    viewport?.addEventListener("scroll", schedule);
    // Rede de segurança barata: confere de vez em quando, caso nenhum evento dispare.
    const interval = setInterval(schedule, 1500);
    settle();

    return () => {
      if (frame) cancelAnimationFrame(frame);
      timers.forEach(clearTimeout);
      clearInterval(interval);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", settle);
      window.removeEventListener("orientationchange", settle);
      window.removeEventListener("pageshow", settle);
      document.removeEventListener("visibilitychange", onVisible);
      document.removeEventListener("focusin", settle);
      document.removeEventListener("focusout", settle);
      document.removeEventListener("touchend", settle);
      viewport?.removeEventListener("resize", settle);
      viewport?.removeEventListener("scroll", schedule);
      if (element.isConnected) element.style.bottom = "";
    };
  }, [ref]);
}
