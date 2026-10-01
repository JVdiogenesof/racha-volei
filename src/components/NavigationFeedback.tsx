"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

export function NavigationFeedback() {
  const pathname = usePathname();
  const [navigationFromPath, setNavigationFromPath] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = navigationFromPath === pathname;

  useEffect(() => {
    const start = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;

      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin) return;
      if (`${destination.pathname}${destination.search}` === `${window.location.pathname}${window.location.search}`) return;

      setNavigationFromPath(pathname);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setNavigationFromPath(null), 8000);
    };

    document.addEventListener("click", start, true);
    return () => {
      document.removeEventListener("click", start, true);
    };
  }, [pathname]);

  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px] overflow-hidden transition-opacity duration-150 ${pending ? "opacity-100" : "opacity-0"}`}
    >
      <span className="navigation-progress block h-full w-2/5 rounded-r-full bg-gradient-to-r from-fuchsia-400 via-purple-300 to-cyan-300 shadow-[0_0_14px_rgba(196,181,253,0.9)]" />
    </div>
  );
}
