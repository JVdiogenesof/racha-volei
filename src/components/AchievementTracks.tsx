"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, Gift, Lock, X } from "lucide-react";
import { CATEGORY_LABEL, TIER_LABEL, type AchievementCategory, type AchievementTrack } from "@/lib/achievements";
import { TIER_STYLE, rewardText } from "@/lib/achievementStyle";

export function AchievementTracks({ tracks }: { tracks: AchievementTrack[] }) {
  const [category, setCategory] = useState<AchievementCategory | "all">("all");
  const [selected, setSelected] = useState<string | null>(null);

  const totalLevels = tracks.reduce((sum, track) => sum + track.levels.length, 0);
  const reachedLevels = tracks.reduce((sum, track) => sum + track.levels.filter((level) => level.unlocked).length, 0);
  const categories = useMemo(() => [...new Set(tracks.map((track) => track.category))], [tracks]);
  const visible = tracks.filter((track) => category === "all" || track.category === category);
  const detail = tracks.find((track) => track.id === selected) ?? null;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-purple-300/20 bg-gradient-to-br from-purple-500/15 to-fuchsia-500/5 p-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-purple-200">Nível de conquistas</p>
            <p className="mt-0.5 text-3xl font-black text-white">{reachedLevels}<span className="text-lg text-white/40"> / {totalLevels}</span></p>
          </div>
          <p className="max-w-[12rem] text-right text-xs text-white/55">Cada nível alcançado pode liberar moldura, banner ou efeito.</p>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/25">
          <div className="h-full rounded-full bg-gradient-to-r from-purple-400 via-fuchsia-300 to-amber-200" style={{ width: `${(reachedLevels / totalLevels) * 100}%` }} />
        </div>
      </div>

      <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
        {(["all", ...categories] as const).map((item) => (
          <button key={item} type="button" onClick={() => setCategory(item)} aria-pressed={category === item} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold transition ${category === item ? "border-purple-300 bg-purple-400/20 text-white" : "border-white/10 text-white/55 hover:text-white"}`}>
            {item === "all" ? "Todas" : CATEGORY_LABEL[item]}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {visible.map((track) => {
          const style = track.tier ? TIER_STYLE[track.tier] : null;
          const next = track.next;
          const single = track.levels.length === 1;
          return (
            <button key={track.id} type="button" onClick={() => setSelected(track.id)} aria-label={`Ver conquista ${track.title}`} className={`achievement-card relative overflow-hidden rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:border-white/30 ${style ? `${style.card} shadow-lg ${style.glow}` : "border-white/8 bg-white/[0.025]"}`}>
              {track.tier === "legend" && <span className="achievement-shine pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 bg-gradient-to-r from-transparent via-white/15 to-transparent" />}
              <div className="relative flex items-start gap-3">
                <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl ${track.tier ? "bg-black/20" : "bg-white/5 grayscale"}`}>{track.emoji}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold text-white">{track.title}</p>
                    <span className={`shrink-0 text-[10px] font-black uppercase tracking-wide ${style ? style.text : "text-white/35"}`}>{track.tier ? TIER_LABEL[track.tier] : "Bloqueada"}</span>
                  </div>
                  <p className="mt-0.5 text-xs leading-relaxed text-white/50">{track.description}</p>
                </div>
              </div>

              {!single && (
                <div className="relative mt-3 flex items-center gap-1.5">
                  {track.levels.map((level) => (
                    <span key={level.id} title={TIER_LABEL[level.tier]} className={`flex h-5 flex-1 items-center justify-center rounded-full text-[9px] font-black uppercase ${level.unlocked ? TIER_STYLE[level.tier].pip : "bg-white/8 text-white/25"}`}>
                      {TIER_LABEL[level.tier].slice(0, 3)}
                    </span>
                  ))}
                </div>
              )}

              <div className="relative mt-3">
                <div className="flex items-center justify-between text-[10px] font-medium uppercase tracking-wide text-white/45">
                  <span>{next ? `Rumo a ${single ? "conquistar" : TIER_LABEL[next.tier]}` : "Nível máximo"}</span>
                  <span>{next ? `${Math.min(track.current, next.target)}/${next.target}` : single ? "✔" : `${track.current}`}</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-black/25">
                  <div className={`h-full rounded-full bg-gradient-to-r ${next ? TIER_STYLE[next.tier].bar : "from-purple-400 via-fuchsia-300 to-amber-200"}`} style={{ width: `${track.percentToNext}%` }} />
                </div>
              </div>

              {next && next.rewards.length > 0 && (
                <p className="relative mt-2.5 flex items-start gap-1.5 text-[11px] leading-snug text-amber-200/85">
                  <Gift className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                  {next.rewards.map(rewardText).join(" · ")}
                </p>
              )}
            </button>
          );
        })}
      </div>

      {detail && <TrackModal track={detail} onClose={() => setSelected(null)} />}
    </div>
  );
}

function TrackModal({ track, onClose }: { track: AchievementTrack; onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 p-3 backdrop-blur-sm sm:items-center" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section role="dialog" aria-modal="true" aria-label={track.title} className="animate-toast-in max-h-[88dvh] w-full max-w-sm overflow-y-auto rounded-3xl border border-white/15 bg-gradient-to-br from-[#322064] to-[#11132e] p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-300/20 bg-amber-300/10 text-4xl">{track.emoji}</span>
          <button type="button" onClick={onClose} aria-label="Fechar" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-white/55 hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button>
        </div>
        <p className="mt-4 text-xs font-bold uppercase tracking-[0.18em] text-purple-300">{CATEGORY_LABEL[track.category]}</p>
        <h2 className="mt-1 text-2xl font-black text-white">{track.title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-white/65">{track.description}</p>
        {track.unit && <p className="mt-2 text-xs text-white/45">Você tem <strong className="text-white">{track.current}</strong> {track.unit}.</p>}

        <ol className="mt-4 space-y-2">
          {track.levels.map((level) => (
            <li key={level.id} className={`rounded-2xl border p-3 ${level.unlocked ? TIER_STYLE[level.tier].card : "border-white/8 bg-black/15"}`}>
              <div className="flex items-center justify-between gap-2">
                <span className={`inline-flex items-center gap-1.5 text-sm font-black ${level.unlocked ? TIER_STYLE[level.tier].text : "text-white/45"}`}>
                  {level.unlocked ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : <Lock className="h-3.5 w-3.5" aria-hidden />}
                  {TIER_LABEL[level.tier]}
                </span>
                {track.levels.length > 1 && <span className="text-xs font-semibold text-white/55">{Math.min(track.current, level.target)}/{level.target}</span>}
              </div>
              {level.rewards.length > 0 ? (
                <ul className="mt-1.5 space-y-0.5 text-[11px] text-white/60">
                  {level.rewards.map((reward) => (
                    <li key={`${reward.kind}-${reward.id}`} className="flex items-center gap-1.5"><Gift className="h-3 w-3 text-amber-300/80" aria-hidden /> {rewardText(reward)}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1.5 text-[11px] text-white/35">Sem cosmético neste nível.</p>
              )}
            </li>
          ))}
        </ol>
      </section>
    </div>,
    document.body,
  );
}
