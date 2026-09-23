"use client";

import { useEffect } from "react";
import { CheckCircle2, Lock, X } from "lucide-react";
import type { Achievement } from "@/lib/achievements";

const TIER_LABELS: Record<Achievement["tier"], string> = {
  bronze: "Bronze",
  silver: "Prata",
  gold: "Ouro",
  special: "Especial",
};

export function AchievementDetailsModal({
  achievement,
  ownerName,
  onClose,
}: {
  achievement: Achievement;
  ownerName?: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const progress = Math.min(100, (achievement.current / achievement.target) * 100);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 p-3 backdrop-blur-sm sm:items-center"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="achievement-dialog-title"
        className="animate-toast-in w-full max-w-sm rounded-3xl border border-white/15 bg-gradient-to-br from-[#322064] to-[#11132e] p-5 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-300/20 bg-amber-300/10 text-4xl">
            {achievement.unlocked ? achievement.emoji : <Lock className="h-6 w-6 text-white/35" />}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar detalhes da conquista"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-white/55 hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-4 text-xs font-bold uppercase tracking-[0.18em] text-purple-300">
          Conquista {TIER_LABELS[achievement.tier]}
        </p>
        <h2 id="achievement-dialog-title" className="mt-1 text-2xl font-black text-white">
          {achievement.title}
        </h2>
        {ownerName && <p className="mt-1 text-xs text-white/40">Conquista de {ownerName}</p>}
        <p className="mt-3 text-sm leading-relaxed text-white/65">{achievement.description}</p>

        <div className="mt-5 rounded-2xl border border-white/8 bg-black/15 p-4">
          <div className="flex items-center justify-between gap-3">
            <span className={`inline-flex items-center gap-1.5 text-sm font-semibold ${achievement.unlocked ? "text-green-300" : "text-white/55"}`}>
              {achievement.unlocked ? <CheckCircle2 className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
              {achievement.unlocked ? "Conquista desbloqueada" : "Ainda bloqueada"}
            </span>
            <strong className="text-sm text-white">
              {Math.min(achievement.current, achievement.target)}/{achievement.target}
            </strong>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/8">
            <div
              className={`h-full rounded-full ${achievement.unlocked ? "bg-gradient-to-r from-brand-purple to-amber-300" : "bg-white/25"}`}
              style={{ width: `${progress}%` }}
            />
          </div>
          {!achievement.unlocked && (
            <p className="mt-2 text-xs text-white/40">
              Faltam {Math.max(0, achievement.target - achievement.current)} para desbloquear.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
