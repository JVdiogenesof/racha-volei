"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MUSIC_TEAM_NAMES } from "@/lib/teamNames";
import { teamBrandFor } from "@/lib/teamLogos";

const SLIDE_MS = 3800;

/** Carrossel automático com as logos dos times (tela de início). Só apresentação. */
export function TeamsCarousel() {
  const slides = MUSIC_TEAM_NAMES.map((name) => ({ name, brand: teamBrandFor(name)! })).filter((slide) => slide.brand);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const touchStart = useRef<number | null>(null);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const go = useCallback((next: number) => setIndex((next + slides.length) % slides.length), [slides.length]);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduceMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (paused || reduceMotion) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") setIndex((current) => (current + 1) % slides.length);
    }, SLIDE_MS);
    return () => window.clearInterval(timer);
  }, [paused, reduceMotion, slides.length]);

  useEffect(() => () => { if (resumeTimer.current) clearTimeout(resumeTimer.current); }, []);

  function pauseBriefly() {
    setPaused(true);
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => setPaused(false), 6000);
  }

  return (
    <section
      aria-roledescription="carrossel"
      aria-label="Times do VPA"
      className="overflow-hidden rounded-2xl border border-purple-300/25 bg-[#10071f] shadow-xl shadow-purple-950/20"
    >
      <div
        className="relative aspect-[5/4] overflow-hidden touch-pan-y"
        onTouchStart={(event) => { touchStart.current = event.touches[0].clientX; }}
        onTouchEnd={(event) => {
          if (touchStart.current == null) return;
          const delta = event.changedTouches[0].clientX - touchStart.current;
          touchStart.current = null;
          if (Math.abs(delta) > 40) { go(index + (delta < 0 ? 1 : -1)); pauseBriefly(); }
        }}
      >
        <div className="flex h-full transition-transform duration-700 ease-out" style={{ transform: `translateX(-${index * 100}%)` }}>
          {slides.map(({ name, brand }, position) => (
            <div
              key={name}
              role="group"
              aria-roledescription="slide"
              aria-label={`Time ${name}`}
              aria-hidden={position !== index}
              className="relative flex h-full w-full shrink-0 items-center justify-center"
              style={{ background: `radial-gradient(circle at 50% 40%, ${brand.glow}, transparent 62%), ${brand.panel}` }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={brand.logoWeb} alt={`Logo do time ${name}`} className="h-[88%] w-auto object-contain" draggable={false} loading={position === 0 ? "eager" : "lazy"} />
            </div>
          ))}
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#130827] to-transparent" />
        <div className="absolute inset-x-0 bottom-2.5 flex items-center justify-center gap-2">
          {slides.map(({ name, brand }, position) => (
            <button
              key={name}
              type="button"
              aria-label={`Ver time ${name}`}
              aria-current={position === index}
              onClick={() => { go(position); pauseBriefly(); }}
              className="h-2 rounded-full transition-all"
              style={{ width: position === index ? 22 : 8, background: position === index ? brand.accent : "rgba(255,255,255,.35)" }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
