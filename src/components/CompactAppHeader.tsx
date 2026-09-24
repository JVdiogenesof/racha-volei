"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

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
  navigation,
}: {
  topBar: ReactNode;
  navigation: ReactNode;
}) {
  const [compact, setCompact] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let frame = 0;

    const update = () => {
      frame = 0;
      const pageHeight = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(pageHeight > 0 ? Math.min(100, (Math.max(0, window.scrollY) / pageHeight) * 100) : 0);
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
      <header className={`app-header-background sticky top-0 z-20 border-b text-white shadow-xl shadow-black/10 backdrop-blur-xl [overflow-anchor:none] transition-colors duration-300 ${compact ? "border-white/15" : "border-white/10"}`}>
        <div>{topBar}</div>
        {navigation}
        <span aria-hidden="true" className="absolute bottom-0 left-0 h-[2px] bg-gradient-to-r from-fuchsia-400 via-purple-300 to-cyan-300 transition-[width] duration-150" style={{ width: `${progress}%` }} />
      </header>
    </CompactHeaderContext.Provider>
  );
}
