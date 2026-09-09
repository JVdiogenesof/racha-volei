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
    document.addEventListener("touchstart", noop, { passive: true });
    return () => document.removeEventListener("touchstart", noop);
  }, []);

  return null;
}
