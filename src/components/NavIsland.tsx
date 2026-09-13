"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, CalendarDays, Users, Award, Megaphone, History, ShieldCheck, type LucideIcon } from "lucide-react";

const LINKS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "Início", icon: Home },
  { href: "/racha", label: "Rachas", icon: CalendarDays },
  { href: "/jogadores", label: "Jogadores", icon: Users },
  { href: "/ranking", label: "Ranking", icon: Award },
  { href: "/avisos", label: "Avisos", icon: Megaphone },
  { href: "/historico", label: "Histórico", icon: History },
];

function isActiveHref(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavIsland({
  badgeByHref,
  isOrganizer,
}: {
  badgeByHref: Record<string, number>;
  isOrganizer: boolean;
}) {
  const pathname = usePathname();
  const adminActive = isActiveHref(pathname, "/admin");

  return (
    <nav className="flex justify-center overflow-x-auto border-t border-white/10 px-2 py-2.5">
      <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1.5">
        {LINKS.map((link) => {
          const active = isActiveHref(pathname, link.href);
          const badge = badgeByHref[link.href] ?? 0;
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-label={link.label}
              className={`relative flex h-9 shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded-full text-white/60 transition-all duration-300 ease-out ${
                active ? "bg-brand-purple px-3.5 text-white" : "w-9 hover:bg-white/10 hover:text-white/80"
              }`}
            >
              <link.icon className="h-4 w-4 shrink-0" strokeWidth={2} />
              {active && (
                <span className="animate-nav-label whitespace-nowrap text-xs font-semibold">{link.label}</span>
              )}
              {!active && badge > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold leading-none text-white">
                  {badge > 9 ? "9+" : badge}
                </span>
              )}
            </Link>
          );
        })}

        {isOrganizer && (
          <>
            <span className="mx-1 h-5 w-px shrink-0 bg-white/15" />
            <Link
              href="/admin/solicitacoes"
              aria-label="Admin"
              className={`flex h-9 shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded-full transition-all duration-300 ease-out ${
                adminActive ? "bg-red-500/20 px-3.5 text-red-300" : "w-9 text-red-300/70 hover:bg-white/10 hover:text-red-300"
              }`}
            >
              <ShieldCheck className="h-4 w-4 shrink-0" strokeWidth={2} />
              {adminActive && <span className="animate-nav-label whitespace-nowrap text-xs font-semibold">Admin</span>}
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
