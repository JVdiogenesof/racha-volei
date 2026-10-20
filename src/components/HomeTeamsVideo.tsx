"use client";

import { useEffect, useRef } from "react";

/** Vídeo em loop dos times (tela de início) -- substituiu o carrossel de logos. Só apresentação. */
export function HomeTeamsVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    // Quem prefere menos movimento não recebe o autoplay -- só o primeiro quadro, parado.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      video.pause();
    }
  }, []);

  return (
    <section className="overflow-hidden rounded-2xl border border-purple-300/25 bg-[#10071f] shadow-xl shadow-purple-950/20">
      <div className="relative aspect-video overflow-hidden bg-black">
        <video
          ref={videoRef}
          src="/carrossel-times.mp4"
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          className="h-full w-full object-cover"
          aria-label="Vídeo dos times do VPA"
        />
      </div>
    </section>
  );
}
