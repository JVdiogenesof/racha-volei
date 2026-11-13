"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Recarrega os dados da página no instante em que algo abre (ex.: Lote 2), sem precisar atualizar à mão. */
export function RefreshAt({ at }: { at: string }) {
  const router = useRouter();
  useEffect(() => {
    const target = new Date(at).getTime();
    let interval: number | undefined;
    const delay = target - Date.now();
    if (delay <= 0 || delay > 2_147_000_000) return;
    // Espera até o horário e faz uma 2ª atualização logo depois, caso o relógio do aparelho esteja adiantado.
    const timer = window.setTimeout(() => {
      router.refresh();
      interval = window.setTimeout(() => router.refresh(), 4_000);
    }, delay + 500);
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(interval);
    };
  }, [at, router]);
  return null;
}
