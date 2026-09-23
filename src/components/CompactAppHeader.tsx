"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const CompactHeaderContext = createContext(false);

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

  useEffect(() => {
    let frame = 0;

    const update = () => {
      frame = 0;
      setCompact((current) => {
        const next = window.scrollY > 72;
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
      <header className="app-header-background sticky top-0 z-20 border-b border-white/10 text-white">
        <div
          className={`grid transition-[grid-template-rows,opacity] duration-300 sm:grid-rows-[1fr] sm:opacity-100 ${
            compact ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"
          }`}
        >
          <div className="min-h-0 overflow-hidden">{topBar}</div>
        </div>
        {navigation}
      </header>
    </CompactHeaderContext.Provider>
  );
}
