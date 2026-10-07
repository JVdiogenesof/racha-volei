"use client";

import { Building2, Waves } from "lucide-react";
import { usePathname } from "next/navigation";
import { useFormStatus } from "react-dom";
import type { Community } from "@/lib/community";
import { switchCommunity } from "@/app/(app)/community/actions";

export function CommunitySwitcher({ active, available }: { active: Community; available: Community[] }) {
  const pathname = usePathname();
  const returnTo = /^\/racha\/[^/]+/.test(pathname) ? "/racha" : pathname;
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
      <input type="hidden" name="returnTo" value={returnTo} />
      <CommunitySwitchButton active={active} next={next} Icon={Icon} />
    </form>
  );
}

function CommunitySwitchButton({ active, next, Icon }: { active: Community; next: Community; Icon: typeof Building2 }) {
  const { pending } = useFormStatus();
  const NextIcon = next === "sand" ? Waves : Building2;
  return <>
    <button
      type="submit"
      disabled={pending}
      className={`community-switch-button flex h-9 items-center gap-1.5 rounded-full border px-2.5 text-[10px] font-black transition ${active === "sand" ? "border-amber-200/25 bg-amber-200/15 text-amber-100" : "border-cyan-200/20 bg-cyan-200/10 text-cyan-100"}`}
      title={`Você está no racha de ${active === "court" ? "quadra" : "areia"}. Toque para ir ao outro ambiente.`}
    >
      <Icon className={`h-3.5 w-3.5 ${pending ? "animate-community-icon-out" : ""}`} />
      <span>{pending ? "Trocando..." : active === "court" ? "Quadra" : "Areia"}</span>
      {!pending && <span className="text-white/35">↔</span>}
    </button>
    {pending && <div aria-live="polite" className={`community-switch-overlay community-switch-overlay-${next}`}>
      <div className="community-switch-orb"><NextIcon className="h-8 w-8" /></div>
      <p className="mt-3 text-xs font-bold uppercase tracking-[0.22em] text-white/60">Abrindo ambiente</p>
      <strong className="mt-1 text-xl text-white">Racha de {next === "sand" ? "Areia" : "Quadra"}</strong>
    </div>}
  </>;
}
