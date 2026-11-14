"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

/**
 * Fundo da tela de login com movimento: a mesma arte de sempre, mas que
 * "respira", segue o dedo/mouse (e a inclinação do celular no Android) com um
 * leve efeito de profundidade, e acende um brilho onde a pessoa toca.
 * Só mexe em transform/opacity e respeita "reduzir movimento".
 */
export function LoginBackdrop() {
  const layerRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);

  useEffect(() => {
    const layer = layerRef.current;
    const glow = glowRef.current;
    if (!layer || !glow) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Alvo (-1..1) vindo do dedo/mouse/giroscópio; o atual persegue o alvo suavemente.
    let tx = 0, ty = 0, cx = 0, cy = 0;
    let gx = 0.5, gy = 0.42, gcx = 0.5, gcy = 0.42, glowOn = 0, glowCur = 0;
    let lastInput = -10_000;
    let boost = 0; // "empurrãozinho" no fundo a cada toque
    let frame = 0;
    const start = performance.now();

    const setFromPoint = (clientX: number, clientY: number) => {
      const w = window.innerWidth || 1, h = window.innerHeight || 1;
      tx = (clientX / w) * 2 - 1;
      ty = (clientY / h) * 2 - 1;
      gx = clientX / w;
      gy = clientY / h;
      glowOn = 1;
      lastInput = performance.now();
    };
    const onPointer = (event: PointerEvent) => setFromPoint(event.clientX, event.clientY);
    const onDown = (event: PointerEvent) => {
      setFromPoint(event.clientX, event.clientY);
      // Toque no botão/link não vira efeito: só o fundo responde.
      if ((event.target as Element | null)?.closest?.("button, a, input, label")) return;
      boost = 1;
      const id = Date.now() + Math.random();
      setRipples((list) => [...list.slice(-3), { id, x: event.clientX, y: event.clientY }]);
      window.setTimeout(() => setRipples((list) => list.filter((item) => item.id !== id)), 1300);
    };
    const onLeave = () => { glowOn = 0; };
    const onTilt = (event: DeviceOrientationEvent) => {
      if (event.gamma == null || event.beta == null) return;
      tx = Math.max(-1, Math.min(1, event.gamma / 25));
      ty = Math.max(-1, Math.min(1, (event.beta - 45) / 25));
      lastInput = performance.now();
    };

    const tick = (now: number) => {
      const t = (now - start) / 1000;
      // Sem interação há 2,5s: passeio lento sozinho, pra tela nunca ficar parada.
      if (now - lastInput > 2500) {
        tx = Math.sin(t * 0.35) * 0.55;
        ty = Math.cos(t * 0.27) * 0.45;
        gx = 0.5 + Math.sin(t * 0.22) * 0.25;
        gy = 0.42 + Math.cos(t * 0.31) * 0.18;
        glowOn = 0.55;
      }
      cx += (tx - cx) * 0.06;
      cy += (ty - cy) * 0.06;
      gcx += (gx - gcx) * 0.12;
      gcy += (gy - gcy) * 0.12;
      glowCur += (glowOn - glowCur) * 0.08;
      boost *= 0.9;
      const breathe = 1 + Math.sin(t * 0.9) * 0.012 + boost * 0.025;
      layer.style.transform = `translate3d(${(-cx * 14).toFixed(2)}px, ${(-cy * 14).toFixed(2)}px, 0) scale(${breathe.toFixed(4)})`;
      glow.style.transform = `translate3d(${(gcx * 100).toFixed(2)}vw, ${(gcy * 100).toFixed(2)}svh, 0)`;
      glow.style.opacity = glowCur.toFixed(3);
      frame = requestAnimationFrame(tick);
    };

    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("pointerleave", onLeave);
    window.addEventListener("deviceorientation", onTilt, { passive: true });
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("deviceorientation", onTilt);
    };
  }, []);

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-20 overflow-hidden">
      {/* Em telas largas a arte não estica: fica centralizada, na proporção do celular, e some nas bordas. */}
      <div
        className="absolute inset-y-0 left-1/2 w-[min(100%,60svh)] -translate-x-1/2"
        style={{ WebkitMaskImage: "linear-gradient(to right, transparent 0%, #000 14%, #000 86%, transparent 100%)", maskImage: "linear-gradient(to right, transparent 0%, #000 14%, #000 86%, transparent 100%)" }}
      >
        <div ref={layerRef} className="absolute -inset-6 will-change-transform">
          <Image
            src="/login-vpa-art.jpg"
            alt=""
            fill
            priority
            sizes="(min-aspect-ratio: 9/16) 60svh, 100vw"
            className="scale-[1.08] object-cover object-center -translate-y-[4%]"
          />
          <div className="login-sheen absolute inset-0" />
        </div>
      </div>
      <div
        ref={glowRef}
        className="pointer-events-none absolute left-0 top-0 h-[70vmin] w-[70vmin] opacity-0 will-change-transform"
        style={{ marginLeft: "-35vmin", marginTop: "-35vmin", background: "radial-gradient(circle, rgba(216,180,254,.32) 0%, rgba(168,85,247,.14) 38%, transparent 68%)", mixBlendMode: "screen" }}
      />
      {ripples.map((ripple) => (
        <span key={ripple.id} className="login-ripple" style={{ left: ripple.x, top: ripple.y }} />
      ))}
    </div>
  );
}
