"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlarmClock } from "lucide-react";

/**
 * Mostra só o horário em que as inscrições abrem (sem contagem regressiva).
 * Quando o horário chega, atualiza a tela sozinha para liberar o botão.
 */
export function RegistrationOpensNotice({ opensAt, label }: { opensAt: string; label: string }) {
  const router = useRouter();

  useEffect(() => {
    const wait = new Date(opensAt).getTime() - Date.now();
    if (wait <= 0) return;
    // setTimeout não aceita atrasos acima de ~24 dias; nesse caso a tela só se atualiza quando for aberta de novo.
    if (wait > 2_000_000_000) return;
    const timer = window.setTimeout(() => router.refresh(), wait + 500);
    return () => window.clearTimeout(timer);
  }, [opensAt, router]);

  return (
    <p className="flex items-start gap-2 rounded-xl border border-amber-200/25 bg-amber-300/15 px-3 py-2.5 text-sm font-bold leading-snug text-amber-50">
      <AlarmClock className="mt-0.5 h-4 w-4 shrink-0 text-amber-200" strokeWidth={2.25} />
      <span className="min-w-0 break-words">
        Inscrições abrem <span className="text-white">{label}</span>
      </span>
    </p>
  );
}
