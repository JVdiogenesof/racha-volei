"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Sparkles } from "lucide-react";
import { BadgeIcon } from "./BadgeIcon";
import { markBadgesSeen } from "@/app/(app)/perfil/actions";
import type { Badge } from "@/lib/badges";

export type NewBadge = { awardId: string; note: string | null; badge: Pick<Badge, "title" | "description" | "emoji" | "color"> };

/**
 * Comemoração de medalha entregue pelo organizador: aparece na próxima vez que
 * a pessoa abre o app, com confete, e não repete (fica marcada como vista).
 * Espera a tela assentar e não abre por cima de outro aviso.
 */
export function BadgeCelebration({ badges }: { badges: NewBadge[] }) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!badges.length) return;
    let cancelled = false;
    let timer = 0;
    const tryOpen = (attempt: number) => {
      if (cancelled) return;
      if (document.querySelector("body .fixed.inset-0") && attempt < 20) {
        timer = window.setTimeout(() => tryOpen(attempt + 1), 2_000);
        return;
      }
      setOpen(true);
    };
    timer = window.setTimeout(() => tryOpen(0), 1_800);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [badges.length]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open || !badges.length) return null;
  const current = badges[index];
  const last = index === badges.length - 1;

  function finish() {
    setOpen(false);
    startTransition(async () => {
      try {
        await markBadgesSeen(badges.map((item) => item.awardId));
      } catch {
        // Sem marcar, a comemoração só aparece de novo na próxima visita.
      }
    });
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" role="presentation">
      <div className="unlock-confetti" aria-hidden>
        {Array.from({ length: 26 }, (_, i) => (
          <i key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${((i * 53) % 100) / 60}s`, animationDuration: `${2.4 + ((i * 17) % 20) / 10}s` }} />
        ))}
      </div>
      <section role="dialog" aria-modal="true" aria-label="Nova medalha" key={current.awardId} className="unlock-pop relative w-full max-w-sm overflow-hidden rounded-3xl border border-amber-300/40 bg-gradient-to-b from-[#3a2275] to-[#140c33] p-6 text-center shadow-2xl">
        <span aria-hidden className="unlock-rays" />
        <p className="relative flex items-center justify-center gap-1.5 text-xs font-black uppercase tracking-[0.22em] text-amber-200">
          <Sparkles className="h-4 w-4" aria-hidden /> Você ganhou uma medalha!
        </p>
        <div className="relative mx-auto mt-5 flex h-28 w-28 items-center justify-center">
          <span aria-hidden className="unlock-ring absolute inset-0 rounded-full" />
          <span className="relative scale-[1.6]"><BadgeIcon badge={current.badge} size="lg" /></span>
        </div>
        <h2 className="relative mt-5 text-2xl font-black text-white">{current.badge.title}</h2>
        {current.badge.description && <p className="relative mt-1.5 text-sm leading-relaxed text-white/70">{current.badge.description}</p>}
        {current.note && (
          <p className="relative mt-3 rounded-2xl border border-amber-300/25 bg-amber-300/10 p-3 text-sm italic text-amber-100">“{current.note}”</p>
        )}
        {badges.length > 1 && <p className="relative mt-4 text-xs text-white/45">{index + 1} de {badges.length}</p>}
        <div className="relative mt-4 flex flex-col gap-2">
          {last ? (
            <button type="button" onClick={finish} className="min-h-11 rounded-xl bg-white px-4 text-sm font-black text-[#3b1975] hover:bg-purple-50">Show!</button>
          ) : (
            <>
              <button type="button" onClick={() => setIndex(index + 1)} className="min-h-11 rounded-xl bg-white px-4 text-sm font-black text-[#3b1975] hover:bg-purple-50">Próxima</button>
              <button type="button" onClick={finish} className="min-h-11 rounded-xl border border-white/15 px-4 text-sm font-bold text-white/60 hover:bg-white/10">Pular todas</button>
            </>
          )}
        </div>
      </section>
    </div>,
    document.body,
  );
}

