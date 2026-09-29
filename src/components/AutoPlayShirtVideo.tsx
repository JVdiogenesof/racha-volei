"use client";

import { useEffect, useRef } from "react";

export function AutoPlayShirtVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // iOS e alguns navegadores móveis só aceitam autoplay quando essas
    // propriedades também são aplicadas no elemento já montado.
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;

    const play = () => {
      if (video.paused) void video.play().catch(() => undefined);
    };
    const playWhenVisible = () => {
      if (document.visibilityState === "visible") play();
    };

    play();
    video.addEventListener("loadeddata", play);
    video.addEventListener("canplay", play);
    document.addEventListener("visibilitychange", playWhenVisible);
    window.addEventListener("pageshow", play);

    // Caso o sistema do celular bloqueie a primeira tentativa, qualquer
    // interação normal com a página libera o vídeo, sem exigir tocar no play.
    window.addEventListener("pointerdown", play, { passive: true });
    window.addEventListener("touchstart", play, { passive: true });

    return () => {
      video.removeEventListener("loadeddata", play);
      video.removeEventListener("canplay", play);
      document.removeEventListener("visibilitychange", playWhenVisible);
      window.removeEventListener("pageshow", play);
      window.removeEventListener("pointerdown", play);
      window.removeEventListener("touchstart", play);
    };
  }, []);

  return (
    <video
      ref={videoRef}
      src="/camisas/video"
      poster="/camisas/colecao-vpa-v2.webp"
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      controls={false}
      disablePictureInPicture
      className="h-full w-full object-cover"
      aria-label="Vídeo de apresentação dos modelos da nova camisa VPA"
    />
  );
}
