import type { AchievementTier, Reward } from "./achievements";
import { AVATAR_FRAMES } from "./avatarFrames";
import { cosmeticName } from "./cosmetics";

/** Cores de cada nível (classes completas pro Tailwind enxergar). */
export const TIER_STYLE: Record<AchievementTier, { card: string; pip: string; text: string; bar: string; glow: string }> = {
  bronze: { card: "border-orange-300/30 bg-orange-400/10", pip: "bg-orange-400 text-orange-950", text: "text-orange-200", bar: "from-orange-500 to-orange-300", glow: "shadow-orange-400/30" },
  silver: { card: "border-slate-200/30 bg-slate-200/10", pip: "bg-slate-200 text-slate-900", text: "text-slate-100", bar: "from-slate-400 to-slate-100", glow: "shadow-slate-200/30" },
  gold: { card: "border-amber-300/40 bg-amber-400/12", pip: "bg-amber-300 text-amber-950", text: "text-amber-200", bar: "from-amber-500 to-yellow-200", glow: "shadow-amber-300/40" },
  legend: { card: "border-fuchsia-300/40 bg-gradient-to-br from-fuchsia-500/20 to-purple-500/10", pip: "bg-gradient-to-br from-fuchsia-300 to-purple-400 text-purple-950", text: "text-fuchsia-200", bar: "from-fuchsia-400 via-purple-300 to-amber-200", glow: "shadow-fuchsia-400/50" },
};

const KIND_LABEL = { frame: "Moldura", banner: "Banner", effect: "Efeito" } as const;

export function rewardText(reward: Reward) {
  return `${KIND_LABEL[reward.kind]}: ${cosmeticName(reward.kind, reward.id, AVATAR_FRAMES)}`;
}
