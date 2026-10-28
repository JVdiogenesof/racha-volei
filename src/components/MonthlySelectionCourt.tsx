"use client";

import dynamic from "next/dynamic";
import { Sparkles } from "lucide-react";
import type { Community } from "@/lib/community";
import type { MonthlySelection } from "@/lib/monthlySelection";

// A cena usa Canvas/WebGL (react-three-fiber), que só existe no navegador --
// carregada sem SSR pra não tentar montar WebGL durante o render no servidor.
const MonthlySelectionCourt3D = dynamic(
  () => import("@/components/MonthlySelectionCourt3D").then((mod) => mod.MonthlySelectionCourt3D),
  {
    ssr: false,
    loading: () => (
      <div className="mx-auto flex aspect-[3/4] w-full max-w-xl animate-pulse items-center justify-center rounded-2xl border-4 border-white/80 bg-[#1b1142]">
        <span className="text-xs font-bold uppercase tracking-wide text-white/40">Montando a maquete…</span>
      </div>
    ),
  },
);

export function MonthlySelectionCourt({
  selection,
  community,
  monthLabel,
}: {
  selection: MonthlySelection;
  community: Community;
  monthLabel: string;
}) {
  if (!selection.setter) return null;

  return (
    <section className="overflow-hidden rounded-[1.75rem] border border-purple-200/20 bg-[#120d2d] shadow-2xl shadow-purple-950/30">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-gradient-to-r from-purple-600/25 to-fuchsia-400/5 px-4 py-4 sm:px-6">
        <div>
          <p className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-amber-200"><Sparkles className="h-3.5 w-3.5" /> Esquadrão VPA</p>
          <h2 className="mt-1 text-xl font-black text-white">Seleção de <span className="capitalize">{monthLabel}</span></h2>
        </div>
        <span className="rounded-full border border-white/10 bg-white/[0.07] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-purple-100">
          {community === "sand" ? "Areia" : "Quadra"}
        </span>
      </div>

      <div className="p-3 sm:p-6">
        <MonthlySelectionCourt3D selection={selection} community={community} />
      </div>
    </section>
  );
}
