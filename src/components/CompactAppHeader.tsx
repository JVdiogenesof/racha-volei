"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

const CompactHeaderContext = createContext(false);

// Limites diferentes evitam que a própria mudança de altura do cabeçalho
// fique alternando o estado quando a rolagem está perto do ponto de corte.
const COMPACT_AFTER_SCROLL_Y = 96;
const EXPAND_BEFORE_SCROLL_Y = 20;

export function useCompactHeader() {
  return useContext(CompactHeaderContext);
}

export function CompactAppHeader({
  topBar,
}: {
  topBar: ReactNode;
}) {
  const [compact, setCompact] = useState(false);
  const barRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let frame = 0;

    const update = () => {
      frame = 0;
      const pageHeight = document.documentElement.scrollHeight - window.innerHeight;
      // Barra de progresso direto no elemento: sem re-render do React a cada quadro da rolagem.
      if (barRef.current) {
        const ratio = pageHeight > 0 ? Math.min(1, Math.max(0, window.scrollY) / pageHeight) : 0;
        barRef.current.style.transform = `scaleX(${ratio})`;
      }
      setCompact((current) => {
        const scrollY = Math.max(0, window.scrollY);
        const next = current
          ? scrollY > EXPAND_BEFORE_SCROLL_Y
          : scrollY >= COMPACT_AFTER_SCROLL_Y;
        return current === next ? current : next;
      });
    };

    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <CompactHeaderContext.Provider value={compact}>
      <header className={`app-header-background sticky top-0 z-20 border-b text-white shadow-xl shadow-black/10 [overflow-anchor:none] transition-colors duration-300 ${compact ? "border-white/15" : "border-white/10"}`}>
        {topBar}
        <span aria-hidden="true" className="header-neon pointer-events-none absolute bottom-0 left-0 h-px w-full" />
        <span ref={barRef} aria-hidden="true" className="absolute bottom-0 left-0 h-[2px] w-full origin-left bg-gradient-to-r from-fuchsia-400 via-purple-300 to-cyan-300" style={{ transform: "scaleX(0)" }} />
      </header>
    </CompactHeaderContext.Provider>
  );
}
