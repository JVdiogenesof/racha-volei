"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Atualiza os dados da página a cada poucos segundos enquanto ela está visível (placar ao vivo). */
export function CopaAutoRefresh({ seconds = 8 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => window.clearInterval(id);
  }, [router, seconds]);
  return null;
}
