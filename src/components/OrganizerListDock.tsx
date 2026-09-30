"use client";

import { type ReactNode, useEffect, useState } from "react";
import { UserRoundPlus, X } from "lucide-react";

export function OrganizerListDock({
  summary,
  controls,
  peopleCount,
  children,
}: {
  summary: string;
  controls: ReactNode;
  peopleCount: number;
  children: ReactNode;
}) {
  const [managerOpen, setManagerOpen] = useState(false);

  useEffect(() => {
    if (!managerOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setManagerOpen(false);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [managerOpen]);

  return (
    <>
      <div className="fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom))] left-1/2 z-40 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-white/15 bg-[#171122]/95 p-1.5 shadow-2xl shadow-black/60 backdrop-blur-xl">
        <span className="hidden max-w-52 truncate pl-2 pr-1 text-[11px] font-medium text-white/55 sm:block">
          {summary}
        </span>
        {controls}
        <button
          type="button"
          onClick={() => setManagerOpen(true)}
          aria-label="Gerenciar e chamar pessoas"
          title="Gerenciar e chamar pessoas"
          className="relative flex h-11 w-11 items-center justify-center rounded-full border border-purple-300/25 bg-brand-purple text-white transition hover:bg-brand-purple-dark"
        >
          <UserRoundPlus className="h-5 w-5" strokeWidth={2} />
          {peopleCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-cyan-300 px-1 text-[9px] font-black text-slate-950">
              {peopleCount > 99 ? "99+" : peopleCount}
            </span>
          )}
        </button>
      </div>

      {managerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-5"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setManagerOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="organizer-manager-title"
            className="max-h-[82dvh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border border-white/15 bg-[#171122] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl sm:p-5"
          >
            <div className="sticky top-0 z-10 mb-4 flex items-center justify-between gap-3 bg-[#171122]/95 pb-2 backdrop-blur-xl">
              <div>
                <h2 id="organizer-manager-title" className="font-semibold text-white">Gerenciar pessoas</h2>
                <p className="text-xs text-white/45">Confirme, convide ou encerre acessos sem poluir a lista.</p>
              </div>
              <button
                type="button"
                onClick={() => setManagerOpen(false)}
                aria-label="Fechar gerenciamento"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3">{children}</div>
          </section>
        </div>
      )}
    </>
  );
}
