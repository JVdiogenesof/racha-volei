"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, Gift, Lock, TrendingUp, X } from "lucide-react";
import {
  CATEGORY_LABEL,
  TIER_LABEL,
  TIER_XP,
  getNearestGoals,
  getVpaLevel,
  type Achievement,
  type AchievementCategory,
  type AchievementTrack,
} from "@/lib/achievements";
import { TIER_STYLE, rewardText } from "@/lib/achievementStyle";
import { AchievementEmblem } from "./AchievementEmblem";

function missingText(track: AchievementTrack) {
  if (!track.next) return "";
  return `${track.current} de ${track.next.target} ${track.unit}`.trim();
}

export function AchievementTracks({ tracks, classics = [] }: { tracks: AchievementTrack[]; classics?: Achievement[] }) {
  const [category, setCategory] = useState<AchievementCategory | "all">("all");
  const [selected, setSelected] = useState<string | null>(null);

  const level = useMemo(() => getVpaLevel(tracks), [tracks]);
  const nearest = useMemo(() => getNearestGoals(tracks, 3), [tracks]);
  const totalLevels = tracks.reduce((sum, track) => sum + track.levels.length, 0);
  const reachedLevels = tracks.reduce((sum, track) => sum + track.levels.filter((item) => item.unlocked).length, 0);
  const categories = useMemo(() => [...new Set(tracks.map((track) => track.category))], [tracks]);
  const visible = tracks.filter((track) => category === "all" || track.category === category);
  const detail = tracks.find((track) => track.id === selected) ?? null;

  return (
    <div className="space-y-5">
      {/* Nível VPA */}
      <div className="relative overflow-hidden rounded-3xl border border-purple-300/25 bg-gradient-to-br from-[#4c1d95]/60 via-[#2a1760]/70 to-[#120a2e] p-4 shadow-lg shadow-purple-950/40">
        <span aria-hidden className="achievement-shine pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        <div className="relative flex items-center gap-4">
          <div className="relative flex h-[76px] w-[76px] shrink-0 items-center justify-center">
            <svg viewBox="0 0 64 64" className="absolute inset-0 h-full w-full" aria-hidden>
              <path d="M32 3 57 17.5v29L32 61 7 46.5v-29Z" fill="#2e1065" stroke="#c4b5fd" strokeWidth="2" />
              <path d="M32 9.5 51.4 20.7v22.6L32 54.5 12.6 43.3V20.7Z" fill="none" stroke="#fde68a" strokeOpacity=".55" strokeWidth="1" />
            </svg>
            <span className="relative flex flex-col items-center leading-none">
              <span className="text-[9px] font-black uppercase tracking-widest text-purple-200">Nível</span>
              <span className="mt-0.5 text-3xl font-black text-white">{level.level}</span>
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-purple-200">Nível VPA</p>
            <p className="truncate text-2xl font-black leading-tight text-white">{level.title}</p>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-black/30">
              <div className="h-full rounded-full bg-gradient-to-r from-purple-400 via-fuchsia-300 to-amber-200 transition-all" style={{ width: `${level.percent}%` }} />
            </div>
            <p className="mt-1.5 text-[11px] font-semibold text-white/60">
              {level.nextAt !== null ? (
                <>
                  <strong className="text-white">{level.xp}</strong>/{level.nextAt} XP · faltam {level.nextAt - level.xp} pra <strong className="text-amber-200">{level.nextTitle}</strong>
                </>
              ) : (
                <>
                  <strong className="text-white">{level.xp} XP</strong> · nível máximo!
                </>
              )}
            </p>
          </div>
        </div>
        <div className="relative mt-3 flex flex-wrap gap-x-3 gap-y-1 border-t border-white/10 pt-2.5 text-[10px] font-bold uppercase tracking-wide text-white/45">
          <span>{reachedLevels}/{totalLevels} níveis</span>
          {(["bronze", "silver", "gold", "legend"] as const).map((tier) => (
            <span key={tier} className={TIER_STYLE[tier].text}>{TIER_LABEL[tier]} +{TIER_XP[tier]} XP</span>
          ))}
        </div>
      </div>

      {/* Quase lá */}
      {nearest.length > 0 && (
        <section>
          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-black uppercase tracking-[0.16em] text-amber-200">
            <TrendingUp className="h-3.5 w-3.5" aria-hidden /> Quase lá
          </h3>
          <div className="no-scrollbar -mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1">
            {nearest.map(({ track }) => (
              <button key={track.id} type="button" onClick={() => setSelected(track.id)} className="flex min-w-[15rem] snap-start items-center gap-3 rounded-2xl border border-amber-300/20 bg-amber-300/[0.07] p-3 text-left transition hover:border-amber-300/40">
                <AchievementEmblem glyph={track.glyph} tone={track.next!.tier} size={44} />
                <span className="min-w-0 flex-1">
                  <strong className="block truncate text-sm text-white">{track.title} · {TIER_LABEL[track.next!.tier]}</strong>
                  <span className="block truncate text-[11px] text-amber-100/70">{missingText(track)}</span>
                  <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-black/30">
                    <span className={`block h-full rounded-full bg-gradient-to-r ${TIER_STYLE[track.next!.tier].bar}`} style={{ width: `${track.percentToNext}%` }} />
                  </span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

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
                <AchievementEmblem glyph={track.glyph} tone={track.tier ?? "locked"} size={52} />
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
                  {track.levels.map((item) => (
                    <span key={item.id} title={TIER_LABEL[item.tier]} className={`flex h-5 flex-1 items-center justify-center rounded-full text-[9px] font-black uppercase ${item.unlocked ? TIER_STYLE[item.tier].pip : "bg-white/8 text-white/25"}`}>
                      {TIER_LABEL[item.tier].slice(0, 3)}
                    </span>
                  ))}
                </div>
              )}

              <div className="relative mt-3">
                <div className="flex items-center justify-between text-[10px] font-medium uppercase tracking-wide text-white/45">
                  <span>{next ? `Rumo a ${single ? "conquistar" : TIER_LABEL[next.tier]} · +${TIER_XP[next.tier]} XP` : "Nível máximo"}</span>
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

      {classics.length > 0 && (
        <details className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <summary className="cursor-pointer text-sm font-bold text-white">
            Conquistas clássicas <span className="font-normal text-white/50">· {classics.filter((item) => item.unlocked).length}/{classics.length}</span>
          </summary>
          <p className="mt-2 text-xs text-white/45">As conquistas de antes da reformulação continuam valendo.</p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {classics.map((item) => (
              <li key={item.id} className={`flex items-center gap-3 rounded-xl border p-3 ${item.unlocked ? "border-amber-300/25 bg-amber-300/8" : "border-white/8 bg-black/15 opacity-70"}`}>
                <AchievementEmblem glyph={item.glyph} tone={item.unlocked ? item.tier : "locked"} size={40} />
                <span className="min-w-0 flex-1">
                  <strong className="block truncate text-sm text-white">{item.title}</strong>
                  <span className="block truncate text-[11px] text-white/50">{item.unlocked ? item.description : `${Math.min(item.current, item.target)}/${item.target} · ${item.description}`}</span>
                </span>
                {item.unlocked && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" aria-hidden />}
              </li>
            ))}
          </ul>
        </details>
      )}

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
          <AchievementEmblem glyph={track.glyph} tone={track.tier ?? "locked"} size={72} />
          <button type="button" onClick={onClose} aria-label="Fechar" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-white/55 hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button>
        </div>
        <p className="mt-4 text-xs font-bold uppercase tracking-[0.18em] text-purple-300">{CATEGORY_LABEL[track.category]}</p>
        <h2 className="mt-1 text-2xl font-black text-white">{track.title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-white/65">{track.description}</p>
        {track.unit && <p className="mt-2 text-xs text-white/45">Você tem <strong className="text-white">{track.current}</strong> {track.unit}.</p>}

        <ol className="mt-4 space-y-2">
          {track.levels.map((item) => (
            <li key={item.id} className={`flex gap-3 rounded-2xl border p-3 ${item.unlocked ? TIER_STYLE[item.tier].card : "border-white/8 bg-black/15"}`}>
              <AchievementEmblem glyph={track.glyph} tone={item.unlocked ? item.tier : "locked"} size={40} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className={`inline-flex items-center gap-1.5 text-sm font-black ${item.unlocked ? TIER_STYLE[item.tier].text : "text-white/45"}`}>
                    {item.unlocked ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : <Lock className="h-3.5 w-3.5" aria-hidden />}
                    {TIER_LABEL[item.tier]}
                  </span>
                  <span className="text-xs font-semibold text-white/55">
                    {track.levels.length > 1 && `${Math.min(track.current, item.target)}/${item.target} · `}+{TIER_XP[item.tier]} XP
                  </span>
                </div>
                {item.rewards.length > 0 ? (
                  <ul className="mt-1.5 space-y-0.5 text-[11px] text-white/60">
                    {item.rewards.map((reward) => (
                      <li key={`${reward.kind}-${reward.id}`} className="flex items-center gap-1.5"><Gift className="h-3 w-3 text-amber-300/80" aria-hidden /> {rewardText(reward)}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1.5 text-[11px] text-white/35">Vale XP pro seu Nível VPA.</p>
                )}
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>,
    document.body,
  );
}
