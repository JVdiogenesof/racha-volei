"use client";

import { useState } from "react";
import { Download, Heart, Loader2, Share2 } from "lucide-react";
import { useToast } from "./Toast";

type FeaturedAchievement = { title: string; emoji: string };

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
};

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

async function fetchCardImage() {
  const response = await fetch("/perfil/cartao/imagem", { cache: "no-store" });
  if (!response.ok) throw new Error((await response.text()) || "Não foi possível gerar seu cartão.");
  return response.blob();
}

function downloadBlob(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "meu-cartao-volei-por-amor.png";
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
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
}: Props) {
  const [busyAction, setBusyAction] = useState<"share" | "download" | null>(null);
  const { showToast } = useToast();

  async function handleShare() {
    setBusyAction("share");
    try {
      const blob = await fetchCardImage();
      const file = new File([blob], "meu-cartao-volei-por-amor.png", { type: "image/png" });
      const shareData = {
        title: "Meu cartão Vôlei Por Amor",
        text: "Meu cartão no Vôlei Por Amor! 🏐💜",
        files: [file],
      };

      if (navigator.share && (!navigator.canShare || navigator.canShare(shareData))) {
        await navigator.share(shareData);
      } else {
        downloadBlob(blob);
        showToast("Cartão baixado! Agora é só compartilhar.");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      showToast(error instanceof Error ? error.message : "Não foi possível compartilhar seu cartão.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleDownload() {
    setBusyAction("download");
    try {
      downloadBlob(await fetchCardImage());
      showToast("Seu cartão foi baixado!");
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
    <section className="overflow-hidden rounded-3xl border border-purple-300/20 bg-gradient-to-br from-[#5523a5] via-[#2d155f] to-[#150b32] p-5 shadow-xl shadow-purple-950/20 sm:p-6">
      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
        <div className="relative flex h-36 w-40 shrink-0 items-center justify-center" aria-label="Moldura de coração do perfil">
          <svg viewBox="0 0 512 512" className="absolute inset-0 h-full w-full drop-shadow-[0_0_18px_rgba(196,181,253,0.35)]" aria-hidden="true">
            <path d="M256 466S44 337 44 177C44 91 113 45 181 45c37 0 63 13 75 27 12-14 38-27 75-27 68 0 137 46 137 132 0 160-212 289-212 289Z" fill="rgba(124,58,237,.24)" stroke="#c4b5fd" strokeWidth="17" />
          </svg>
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt={fullName} className="relative -mt-3 h-24 w-24 rounded-full object-cover ring-4 ring-white/80" referrerPolicy="no-referrer" />
          ) : (
            <span className="relative -mt-3 flex h-24 w-24 items-center justify-center rounded-full bg-brand-purple text-2xl font-black text-white ring-4 ring-white/80">
              {initials(fullName)}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1 text-center sm:text-left">
          <div className="flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-purple-200 sm:justify-start">
            <Heart className="h-4 w-4 fill-current" /> Meu cartão VPA
          </div>
          <h2 className="mt-2 truncate text-2xl font-black text-white">{fullName}</h2>
          {nickname && <p className="mt-0.5 text-sm font-semibold text-purple-200">{nickname}</p>}
          <p className="mt-2 text-sm text-white/60">Seu perfil da quadra pronto para compartilhar.</p>

          <div className="mt-4 grid grid-cols-2 gap-2">
            {statItems.map((item) => (
              <div key={item.label} className="rounded-xl border border-white/10 bg-white/[0.07] px-3 py-2.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-lg font-black text-white">{item.value}</span>
                  <span className="text-xs font-bold text-purple-200">{rankLabel(item.rank)}</span>
                </div>
                <p className="truncate text-[11px] text-white/50">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-white/10 bg-black/10 p-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-bold uppercase tracking-wider text-white/55">Conquistas em destaque</p>
          <span className="text-xs font-semibold text-purple-200">{achievementCount} desbloqueadas</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {achievements.length ? achievements.map((achievement) => (
            <span key={achievement.title} className="inline-flex items-center gap-1.5 rounded-full border border-purple-200/15 bg-purple-200/10 px-3 py-1.5 text-xs font-semibold text-white">
              <span>{achievement.emoji}</span> {achievement.title}
            </span>
          )) : <span className="text-sm text-white/45">A primeira conquista está chegando.</span>}
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button type="button" onClick={handleShare} disabled={busyAction !== null} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-[#3b1975] hover:bg-purple-50 disabled:opacity-60">
          {busyAction === "share" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
          Gerar e compartilhar
        </button>
        <button type="button" onClick={handleDownload} disabled={busyAction !== null} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-bold text-white hover:bg-white/10 disabled:opacity-60">
          {busyAction === "download" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Baixar imagem
        </button>
      </div>
    </section>
  );
}
