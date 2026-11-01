"use client";

import { type ReactNode, useState } from "react";

/**
 * Alterna entre Confirmados e Interessados. As duas listas continuam na página
 * (só ficam escondidas), então formulários e botões mantêm o mesmo funcionamento.
 */
export function RachaListTabs({
  confirmed,
  interested,
  confirmedCount,
  interestedCount,
  showConfirmed = true,
}: {
  confirmed: ReactNode;
  interested: ReactNode;
  confirmedCount: number;
  interestedCount: number;
  /** Quando a lista ainda é privada, só os interessados aparecem (sem abas). */
  showConfirmed?: boolean;
}) {
  const [tab, setTab] = useState<"confirmed" | "interested">("confirmed");

  if (!showConfirmed) return <div>{interested}</div>;

  const tabClass = (active: boolean) =>
    `min-h-10 rounded-xl px-2 py-2 text-center text-[13px] font-bold leading-tight transition ${
      active ? "bg-brand-purple text-white" : "text-white/60 hover:text-white"
    }`;

  return (
    <div>
      <div role="tablist" aria-label="Lista do racha" className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-1 rounded-2xl bg-white/[0.07] p-1">
        <button type="button" role="tab" aria-selected={tab === "confirmed"} onClick={() => setTab("confirmed")} className={tabClass(tab === "confirmed")}>
          Confirmados · {confirmedCount}
        </button>
        <button type="button" role="tab" aria-selected={tab === "interested"} onClick={() => setTab("interested")} className={tabClass(tab === "interested")}>
          Interessados · {interestedCount}
        </button>
      </div>
      <div className="mt-3" hidden={tab !== "confirmed"}>{confirmed}</div>
      <div className="mt-3" hidden={tab !== "interested"}>{interested}</div>
    </div>
  );
}
