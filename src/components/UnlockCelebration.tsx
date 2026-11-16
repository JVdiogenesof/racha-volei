"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Gift, Sparkles } from "lucide-react";
import { PROFILE_TAB_EVENT } from "./ProfileTabs";
import { TIER_LABEL, TIER_XP, type AchievementTier, type Reward } from "@/lib/achievements";
import { AchievementEmblem, type GlyphId } from "./AchievementEmblem";
import { TIER_STYLE, rewardText } from "@/lib/achievementStyle";
import { markUnlocksSeen } from "@/app/(app)/perfil/actions";

export type NewUnlock = {
  levelId: string;
  trackTitle: string;
  glyph: GlyphId;
  tier: AchievementTier;
  rewards: Reward[];
};

/**
 * Comemoração de conquista nova: um cartão por nível alcançado, com confete,
 * brilho e os cosméticos liberados. Ao fechar, marca tudo como visto.
 */
export function UnlockCelebration({ unlocks }: { unlocks: NewUnlock[] }) {
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(unlocks.length > 0);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open || !unlocks.length) return null;
  const current = unlocks[index];
  const last = index === unlocks.length - 1;
  const style = TIER_STYLE[current.tier];

  function finish(goCustomize: boolean) {
    setOpen(false);
    startTransition(async () => {
      try {
        await markUnlocksSeen(unlocks.map((item) => item.levelId));
      } catch {
        // Sem marcar, a comemoração só aparece de novo na próxima visita.
      }
    });
    if (goCustomize) window.dispatchEvent(new CustomEvent(PROFILE_TAB_EVENT, { detail: "personalizar" }));
  }

  const hasRewards = unlocks.some((item) => item.rewards.length > 0);

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" role="presentation">
      <div className="unlock-confetti" aria-hidden>
        {Array.from({ length: 26 }, (_, i) => <i key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${((i * 53) % 100) / 60}s`, animationDuration: `${2.4 + ((i * 17) % 20) / 10}s` }} />)}
      </div>
      <section role="dialog" aria-modal="true" aria-label="Nova conquista" key={current.levelId} className={`unlock-pop relative w-full max-w-sm overflow-hidden rounded-3xl border bg-gradient-to-b from-[#3a2275] to-[#140c33] p-6 text-center shadow-2xl ${style.card} ${style.glow}`}>
        <span aria-hidden className="unlock-rays" />
        <p className="relative flex items-center justify-center gap-1.5 text-xs font-black uppercase tracking-[0.22em] text-amber-200">
          <Sparkles className="h-4 w-4" aria-hidden /> Conquista desbloqueada
        </p>
        <div className="relative mx-auto mt-5 flex h-28 w-28 items-center justify-center">
          <span aria-hidden className="unlock-ring absolute inset-0 rounded-full" />
          <span className="relative drop-shadow-[0_8px_18px_rgba(0,0,0,.45)]"><AchievementEmblem glyph={current.glyph} tone={current.tier} size={104} /></span>
        </div>
        <h2 className="relative mt-4 text-2xl font-black text-white">{current.trackTitle}</h2>
        <span className={`relative mt-2 inline-block rounded-full px-3 py-1 text-xs font-black uppercase tracking-wider ${style.pip}`}>{TIER_LABEL[current.tier]}</span>
        <p className="relative mt-2 text-sm font-black text-amber-200">+{TIER_XP[current.tier]} XP no seu Nível VPA</p>

        {current.rewards.length > 0 && (
          <div className="relative mt-5 rounded-2xl border border-amber-300/25 bg-amber-300/10 p-3 text-left">
            <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wide text-amber-200"><Gift className="h-3.5 w-3.5" aria-hidden /> Você liberou</p>
            <ul className="mt-1.5 space-y-0.5 text-sm font-semibold text-white">
              {current.rewards.map((reward) => <li key={`${reward.kind}-${reward.id}`}>{rewardText(reward)}</li>)}
            </ul>
          </div>
        )}

        <p className="relative mt-4 text-xs text-white/45">{index + 1} de {unlocks.length}</p>
        <div className="relative mt-3 flex flex-col gap-2">
          {last ? (
            <>
              {hasRewards && <button type="button" onClick={() => finish(true)} className="min-h-11 rounded-xl bg-white px-4 text-sm font-black text-[#3b1975] hover:bg-purple-50">Equipar agora</button>}
              <button type="button" onClick={() => finish(false)} className="min-h-11 rounded-xl border border-white/15 px-4 text-sm font-bold text-white/80 hover:bg-white/10">Fechar</button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => setIndex(index + 1)} className="min-h-11 rounded-xl bg-white px-4 text-sm font-black text-[#3b1975] hover:bg-purple-50">Próxima</button>
              <button type="button" onClick={() => finish(false)} className="min-h-11 rounded-xl border border-white/15 px-4 text-sm font-bold text-white/60 hover:bg-white/10">Pular todas</button>
            </>
          )}
        </div>
      </section>
    </div>,
    document.body,
  );
}
