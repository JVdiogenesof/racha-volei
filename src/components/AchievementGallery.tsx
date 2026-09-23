"use client";

import { useState } from "react";
import { Lock, Sparkles } from "lucide-react";
import type { Achievement } from "@/lib/achievements";
import { AchievementDetailsModal } from "@/components/AchievementDetailsModal";

const TIER_CLASSES: Record<Achievement["tier"], string> = {
  bronze: "border-orange-300/20 bg-orange-400/8",
  silver: "border-slate-200/20 bg-slate-200/8",
  gold: "border-amber-300/25 bg-amber-400/10",
  special: "border-purple-300/30 bg-gradient-to-br from-purple-400/15 to-fuchsia-400/5",
};

export function AchievementGallery({ achievements }: { achievements: Achievement[] }) {
  const [selected, setSelected] = useState<Achievement | null>(null);
  const unlockedCount = achievements.filter((achievement) => achievement.unlocked).length;
  const ordered = [...achievements].sort(
    (a, b) => Number(b.unlocked) - Number(a.unlocked) || b.current / b.target - a.current / a.target,
  );

  return (
    <section>
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-300" strokeWidth={2} />
            <h2 className="font-semibold text-white">Minhas conquistas</h2>
          </div>
          <p className="mt-1 text-sm text-white/50">Marcos conquistados dentro e fora da quadra.</p>
        </div>
        <span className="shrink-0 rounded-full bg-brand-purple/20 px-3 py-1 text-xs font-bold text-purple-200">
          {unlockedCount}/{achievements.length}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ordered.map((achievement) => {
          const progress = Math.min(100, (achievement.current / achievement.target) * 100);
          return (
            <button
              type="button"
              key={achievement.id}
              onClick={() => setSelected(achievement)}
              aria-label={`Ver conquista ${achievement.title}`}
              className={`achievement-card relative overflow-hidden rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:border-white/25 ${
                achievement.unlocked ? TIER_CLASSES[achievement.tier] : "border-white/8 bg-white/[0.025] opacity-65"
              }`}
            >
              {achievement.unlocked && achievement.tier === "special" && (
                <span className="achievement-shine pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
              )}
              <div className="relative flex items-start gap-3">
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-2xl ${achievement.unlocked ? "bg-black/15" : "bg-white/5 grayscale"}`}>
                  {achievement.unlocked ? achievement.emoji : <Lock className="h-4 w-4 text-white/30" />}
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-white">{achievement.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-white/50">{achievement.description}</p>
                </div>
              </div>
              <div className="relative mt-3">
                <div className="flex items-center justify-between text-[10px] font-medium uppercase tracking-wide text-white/40">
                  <span>{achievement.unlocked ? "Conquistada" : "Progresso"}</span>
                  <span>{Math.min(achievement.current, achievement.target)}/{achievement.target}</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-black/20">
                  <div
                    className={`h-full rounded-full ${achievement.unlocked ? "bg-gradient-to-r from-brand-purple to-amber-300" : "bg-white/20"}`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
              <span className="relative mt-3 block text-[10px] font-semibold uppercase tracking-wide text-purple-300/75">
                Toque para ver detalhes
              </span>
            </button>
          );
        })}
      </div>
      {selected && <AchievementDetailsModal achievement={selected} onClose={() => setSelected(null)} />}
    </section>
  );
}
