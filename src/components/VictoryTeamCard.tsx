"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Trophy } from "lucide-react";

export const TEAM_VICTORY_EVENT = "racha:team-victory";

export function VictoryTeamCard({ teamId, children }: { teamId: string; children: ReactNode }) {
  const [celebrating, setCelebrating] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onVictory = (rawEvent: Event) => {
      const event = rawEvent as CustomEvent<{ teamId: string }>;
      if (event.detail.teamId !== teamId) return;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setCelebrating(false);
      window.requestAnimationFrame(() => setCelebrating(true));
      timeoutRef.current = setTimeout(() => setCelebrating(false), 1_150);
    };

    window.addEventListener(TEAM_VICTORY_EVENT, onVictory);
    return () => {
      window.removeEventListener(TEAM_VICTORY_EVENT, onVictory);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [teamId]);

  return (
    <div
      className={`relative min-w-0 overflow-hidden rounded-xl border p-4 transition-colors ${
        celebrating
          ? "animate-team-victory border-amber-300/70 bg-amber-300/10"
          : "border-white/10"
      }`}
    >
      {celebrating && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center" aria-hidden="true">
          <span className="animate-victory-badge flex items-center gap-2 rounded-full border border-amber-200/35 bg-[#241447]/95 px-4 py-2 font-bold text-amber-200 shadow-2xl">
            <Trophy className="h-5 w-5" strokeWidth={2.5} />
            Vitória!
          </span>
        </div>
      )}
      {children}
    </div>
  );
}
