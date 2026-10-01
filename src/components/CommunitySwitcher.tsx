"use client";

import { Building2, Waves } from "lucide-react";
import { usePathname } from "next/navigation";
import type { Community } from "@/lib/community";
import { switchCommunity } from "@/app/(app)/community/actions";

export function CommunitySwitcher({ active, available }: { active: Community; available: Community[] }) {
  const pathname = usePathname();
  const next: Community = active === "court" ? "sand" : "court";
  const canSwitch = available.includes(next);
  const Icon = active === "court" ? Building2 : Waves;

  if (!canSwitch) {
    return (
      <span className="flex h-9 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.07] px-2.5 text-[10px] font-bold text-white/70" title={active === "court" ? "Racha de Quadra" : "Racha de Areia"}>
        <Icon className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{active === "court" ? "Quadra" : "Areia"}</span>
      </span>
    );
  }

  return (
    <form action={switchCommunity}>
      <input type="hidden" name="community" value={next} />
      <input type="hidden" name="returnTo" value={pathname} />
      <button
        type="submit"
        className={`flex h-9 items-center gap-1.5 rounded-full border px-2.5 text-[10px] font-black transition ${active === "sand" ? "border-amber-200/25 bg-amber-200/15 text-amber-100" : "border-cyan-200/20 bg-cyan-200/10 text-cyan-100"}`}
        title={`Você está no racha de ${active === "court" ? "quadra" : "areia"}. Toque para ir ao outro ambiente.`}
      >
        <Icon className="h-3.5 w-3.5" />
        <span>{active === "court" ? "Quadra" : "Areia"}</span>
        <span className="text-white/35">↔</span>
      </button>
    </form>
  );
}
