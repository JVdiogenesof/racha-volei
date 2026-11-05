"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Check, ChevronRight, QrCode } from "lucide-react";
import { InterestButton } from "@/components/InterestButton";
import type { HeaderAction } from "@/lib/headerAction";

const TONES: Record<HeaderAction["tone"], { box: string; subtitle: string }> = {
  action: { box: "border-fuchsia-300/25 from-fuchsia-500/35 to-violet-500/20", subtitle: "text-emerald-200" },
  pay: { box: "border-emerald-300/30 from-emerald-500/30 to-emerald-500/10", subtitle: "text-emerald-100" },
  calm: { box: "border-white/15 from-white/10 to-white/5", subtitle: "text-white/65" },
};

const CTA_STYLE = "inline-flex h-9 shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-xl px-3 text-xs font-black shadow-lg shadow-black/20 transition disabled:opacity-60";

function formatLeft(milliseconds: number) {
  const seconds = Math.ceil(milliseconds / 1000);
  if (seconds >= 3600) return `${Math.floor(seconds / 3600)}h${String(Math.floor((seconds % 3600) / 60)).padStart(2, "0")}`;
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** Faixa do cabeçalho com a próxima ação da pessoa no racha. */
export function HeaderActionStrip({
  action,
  interestAction,
}: {
  action: HeaderAction | null;
  interestAction: (formData: FormData) => Promise<void> | void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [now, setNow] = useState<number | null>(null);
  const expiresAt = action?.expiresAt;
  const opensAt = action?.opensAt;

  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => {
      const current = Date.now();
      setNow(current);
      if (current >= new Date(expiresAt).getTime()) {
        window.clearInterval(timer);
        router.refresh();
      }
    };
    const timer = window.setInterval(tick, 1000);
    const first = window.setTimeout(tick, 0);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(first);
    };
  }, [expiresAt, router]);

  // Quando as inscrições abrem, a faixa troca sozinha. Cada um atualiza num
  // instante um pouco diferente, para não recarregarem todos juntos.
  useEffect(() => {
    if (!opensAt) return;
    const wait = new Date(opensAt).getTime() - Date.now();
    if (wait <= 0 || wait > 2_000_000_000) return;
    const timer = window.setTimeout(() => router.refresh(), wait + 500 + Math.random() * 2000);
    return () => window.clearTimeout(timer);
  }, [opensAt, router]);

  // Na própria lista desse racha o botão já está na tela.
  if (!action || pathname === `/racha/${action.eventId}/confirmar`) return null;

  const tone = TONES[action.tone];
  const left = expiresAt && now !== null ? new Date(expiresAt).getTime() - now : null;
  const ctaColors = action.cta?.icon === "pay" ? "bg-emerald-500 text-white hover:bg-emerald-400" : action.tone === "calm" ? "bg-white/15 text-white hover:bg-white/20" : "bg-white text-[#4c1d95] hover:bg-purple-50";

  return (
    <div className={`flex min-w-0 items-center gap-2.5 rounded-2xl border bg-gradient-to-r p-2 ${tone.box}`}>
      <span className="shrink-0 overflow-hidden rounded-xl bg-white text-center leading-none text-[#3b1a7a] shadow-md shadow-black/25">
        <span className="block bg-fuchsia-500 px-2.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-white">{action.weekday}</span>
        <span className="block px-2.5 py-1 text-lg font-black">{action.day}</span>
      </span>
      <Link href={action.cta?.href ?? `/racha/${action.eventId}/confirmar`} className="min-w-0 flex-1 leading-tight">
        <span className="block truncate text-[13px] font-black text-white">{action.title}</span>
        <span className={`mt-0.5 block truncate text-[11px] font-semibold ${tone.subtitle}`}>
          {action.subtitle}
          {left !== null && left > 0 && <span className="tabular-nums"> · {formatLeft(left)}</span>}
        </span>
      </Link>
      {action.cta ? (
        <Link href={action.cta.href} className={`${CTA_STYLE} ${ctaColors}`}>
          {action.cta.icon === "pay" && <QrCode className="h-3.5 w-3.5" strokeWidth={2.75} />}
          {action.cta.icon === "check" && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
          {action.cta.label}
          {action.cta.icon === "view" && <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.75} />}
        </Link>
      ) : action.interest ? (
        <InterestButton
          eventId={action.eventId}
          price={action.interest.price}
          isFull={action.interest.isFull}
          pixPaymentEnabled={action.interest.pixEnabled}
          action={interestAction}
          className={`${CTA_STYLE} bg-white text-[#4c1d95] hover:bg-purple-50`}
          label={action.interest.isFull ? "Entrar na fila" : undefined}
        />
      ) : null}
    </div>
  );
}
