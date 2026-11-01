"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Medal, Trophy } from "lucide-react";

const TABS = [
  { href: "/torneios-vpa/copa", label: "Copa VPA", icon: Medal, badge: "Novo" },
  { href: "/torneios-vpa", label: "Torneio oficial", icon: Trophy },
];

export function TorneiosVpaTabs() {
  const pathname = usePathname();

  return (
    <nav aria-label="Torneios VPA" className="no-scrollbar flex gap-1 overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.03] p-1">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-10 flex-1 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold leading-none transition ${
              active ? "bg-brand-purple text-white shadow-md shadow-purple-950/30" : "text-white/50 hover:bg-white/5 hover:text-white/80"
            }`}
          >
            <tab.icon className="h-4 w-4 shrink-0" strokeWidth={2.25} />
            {tab.label}
            {tab.badge && !active && (
              <span className="rounded-full bg-amber-300 px-1.5 py-0.5 text-[9px] font-black uppercase text-amber-950">{tab.badge}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
