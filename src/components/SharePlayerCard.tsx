"use client";

import { useState } from "react";
import { Download, Loader2, Share2 } from "lucide-react";
import { ProfileHero } from "./ProfileHero";
import { AchievementEmblem, type GlyphId } from "./AchievementEmblem";
import type { AchievementTier } from "@/lib/achievements";
import type { Badge } from "@/lib/badges";
import { useToast } from "./Toast";
import { saveImageBlob, shareImageOrSave } from "@/lib/clientImageShare";

type FeaturedAchievement = { title: string; glyph: GlyphId; tier: AchievementTier };

type Props = {
  fullName: string;
  avatarUrl: string | null;
  nickname: string | null;
  stats: {
    attendance: number;
    wins: number;
    mvp: number;
    performance: number | null;
  };
  rankings: {
    attendance: number | null;
    wins: number | null;
    mvp: number | null;
    performance: number | null;
  };
  achievements: FeaturedAchievement[];
  achievementCount: number;
  avatarFrame: string | null;
  banner: string | null;
  effect: string | null;
  isSetter: boolean;
  featuredBadges: Badge[];
};

async function fetchCardImage() {
  const response = await fetch("/perfil/cartao/imagem", { cache: "no-store" });
  if (!response.ok) throw new Error((await response.text()) || "Não foi possível gerar seu cartão.");
  return response.blob();
}

function rankLabel(position: number | null) {
  return position ? `#${position}` : "—";
}

export function SharePlayerCard({
  fullName,
  avatarUrl,
  nickname,
  stats,
  rankings,
  achievements,
  achievementCount,
  avatarFrame,
  banner,
  effect,
  isSetter,
  featuredBadges,
}: Props) {
  const [busyAction, setBusyAction] = useState<"share" | "download" | null>(null);
  const { showToast } = useToast();

  async function handleShare() {
    setBusyAction("share");
    try {
      const blob = await fetchCardImage();
      const result = await shareImageOrSave({
        blob,
        filename: "meu-cartao-volei-por-amor.png",
        title: "Meu cartão Vôlei Por Amor",
        text: "Meu cartão no Vôlei Por Amor! 🏐💜",
      });
      if (result === "saved") showToast("Cartão salvo no aparelho! Agora é só compartilhar.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Não foi possível compartilhar seu cartão.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleDownload() {
    setBusyAction("download");
    try {
      saveImageBlob(await fetchCardImage(), "meu-cartao-volei-por-amor.png");
      showToast("Seu cartão foi salvo no aparelho!");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Não foi possível baixar seu cartão.");
    } finally {
      setBusyAction(null);
    }
  }

  const statItems = [
    { label: "Presenças", value: stats.attendance, rank: rankings.attendance },
    { label: "Vitórias", value: stats.wins, rank: rankings.wins },
    { label: "Destaques", value: stats.mvp, rank: rankings.mvp },
    { label: "Aproveitamento", value: stats.performance === null ? "—" : `${stats.performance}%`, rank: rankings.performance },
  ];

  return (
    <ProfileHero
      fullName={fullName}
      avatarUrl={avatarUrl}
      avatarFrame={avatarFrame}
      banner={banner}
      effect={effect}
      nickname={nickname}
      isSetter={isSetter}
      badges={featuredBadges}
      showEmptyBadgeSlots
      eyebrow="Meu cartão VPA"
    >
      <div className="mt-4 grid grid-cols-4 gap-1.5">
        {statItems.map((item) => (
          <div key={item.label} className="rounded-xl border border-white/10 bg-white/[0.07] px-1.5 py-2 text-center">
            <span className="block text-lg font-black leading-none text-white">{item.value}</span>
            <span className="mt-1 block text-[10px] font-bold text-purple-200">{rankLabel(item.rank)}</span>
            <span className="mt-0.5 block truncate text-[10px] text-white/50">{item.label}</span>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/15 px-3 py-2">
        <p className="text-xs font-semibold text-white/60">{achievementCount} níveis de conquista</p>
        <div className="flex gap-1" aria-label="Conquistas em destaque">
          {achievements.map((achievement) => <span key={achievement.title} title={achievement.title}><AchievementEmblem glyph={achievement.glyph} tone={achievement.tier} size={26} /></span>)}
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <button type="button" onClick={handleShare} disabled={busyAction !== null} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-[#3b1975] hover:bg-purple-50 disabled:opacity-60">
          {busyAction === "share" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
          Gerar e compartilhar
        </button>
        <button type="button" onClick={handleDownload} disabled={busyAction !== null} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-bold text-white hover:bg-white/10 disabled:opacity-60">
          {busyAction === "download" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Salvar na galeria
        </button>
      </div>
    </ProfileHero>
  );
}
