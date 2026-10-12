"use client";

import { type ReactNode, useState } from "react";
import { Cake, Megaphone } from "lucide-react";

export function HomeCommunityTabs({
  announcementContent,
  birthdaysContent,
  birthdayCount,
}: {
  announcementContent: ReactNode;
  birthdaysContent: ReactNode;
  birthdayCount: number;
}) {
  const [active, setActive] = useState<"announcement" | "birthdays">("announcement");

  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025]">
      <div className="grid grid-cols-2 gap-1 border-b border-white/10 p-1">
        <button
          type="button"
          onClick={() => setActive("announcement")}
          aria-pressed={active === "announcement"}
          className={`flex min-h-9 items-center justify-center gap-1.5 rounded-xl text-xs font-bold transition ${active === "announcement" ? "bg-brand-purple text-white" : "text-white/45 hover:bg-white/5"}`}
        >
          <Megaphone className="h-3.5 w-3.5" strokeWidth={2.25} /> Último aviso
        </button>
        <button
          type="button"
          onClick={() => setActive("birthdays")}
          aria-pressed={active === "birthdays"}
          className={`flex min-h-9 items-center justify-center gap-1.5 rounded-xl text-xs font-bold transition ${active === "birthdays" ? "bg-brand-purple text-white" : "text-white/45 hover:bg-white/5"}`}
        >
          <Cake className="h-3.5 w-3.5" strokeWidth={2.25} /> Aniversários
          {birthdayCount > 0 && <span className="rounded-full bg-white/15 px-1.5 py-0.5 text-[10px]">{birthdayCount}</span>}
        </button>
      </div>
      <div>{active === "announcement" ? announcementContent : birthdaysContent}</div>
    </section>
  );
}
