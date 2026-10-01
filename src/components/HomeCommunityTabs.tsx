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
    <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-2.5 sm:p-3">
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-black/10 p-1">
        <button
          type="button"
          onClick={() => setActive("announcement")}
          aria-pressed={active === "announcement"}
          className={`flex min-h-10 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition ${active === "announcement" ? "bg-brand-purple text-white" : "text-white/45 hover:bg-white/5"}`}
        >
          <Megaphone className="h-4 w-4" /> Último aviso
        </button>
        <button
          type="button"
          onClick={() => setActive("birthdays")}
          aria-pressed={active === "birthdays"}
          className={`flex min-h-10 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition ${active === "birthdays" ? "bg-brand-purple text-white" : "text-white/45 hover:bg-white/5"}`}
        >
          <Cake className="h-4 w-4" /> Aniversários
          {birthdayCount > 0 && <span className="rounded-full bg-white/15 px-1.5 py-0.5 text-[10px]">{birthdayCount}</span>}
        </button>
      </div>
      <div className="mt-2">{active === "announcement" ? announcementContent : birthdaysContent}</div>
    </section>
  );
}
