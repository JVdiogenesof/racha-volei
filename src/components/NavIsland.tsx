"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Users, Award, Megaphone, History, Trophy, ShieldCheck, Shirt, Clapperboard, type LucideIcon } from "lucide-react";
import { useCompactHeader } from "@/components/CompactAppHeader";

const LINKS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/racha", label: "Rachas", icon: CalendarDays },
  { href: "/jogadores", label: "Jogadores", icon: Users },
  { href: "/ranking", label: "Ranking", icon: Award },
  { href: "/momentos", label: "Momentos", icon: Clapperboard },
  { href: "/torneios-vpa", label: "Torneios VPA", icon: Trophy },
  { href: "/camisas", label: "Camisas VPA", icon: Shirt },
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
  canViewShirts = false,
  activeHrefOverride,
}: {
  badgeByHref: Record<string, number>;
  isOrganizer: boolean;
  canViewShirts?: boolean;
  activeHrefOverride?: string;
}) {
  const routePathname = usePathname();
  const pathname = activeHrefOverride ?? routePathname;
  const adminActive = isActiveHref(pathname, "/admin");
  const compact = useCompactHeader();

  return (
    <nav aria-label="Navegação principal" className={`nav-island-shell border-t border-white/10 px-2 transition-[padding] duration-300 sm:flex sm:justify-center sm:px-3 ${compact ? "py-1.5 sm:py-2" : "py-2 sm:py-2.5"}`}>
      <div
        className="nav-island no-scrollbar mx-auto flex w-full max-w-full items-center gap-1 overflow-x-auto rounded-full border border-white/10 bg-black/10 p-1 transition-all duration-300 sm:w-auto sm:max-w-none sm:overflow-visible sm:p-1.5"
      >
        {LINKS.filter((link) => link.href !== "/camisas" || canViewShirts).map((link) => {
          const active = isActiveHref(pathname, link.href);
          const badge = badgeByHref[link.href] ?? 0;
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-label={link.label}
              aria-current={active ? "page" : undefined}
              className={`nav-island-item relative flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-full text-white/60 transition-all duration-300 ease-out sm:h-9 ${
                active ? "nav-island-active w-auto bg-gradient-to-r from-purple-600 to-violet-500 px-3 text-white shadow-md shadow-purple-950/30 sm:px-3.5" : "w-10 px-0 hover:bg-white/10 hover:text-white/80 sm:w-9"
              }`}
            >
              <link.icon className="h-4 w-4 shrink-0" strokeWidth={2} />
              {active && <span className="animate-nav-label whitespace-nowrap text-[10px] font-semibold leading-none sm:text-xs">{link.label}</span>}
              {!active && badge > 0 && (
                <span className="nav-island-badge absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold leading-none text-white">
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
              href="/admin/reserva"
              aria-label="Admin"
              aria-current={adminActive ? "page" : undefined}
              className={`nav-island-item flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-full transition-all duration-300 ease-out sm:h-9 ${
                adminActive ? "nav-island-active w-auto bg-red-500/20 px-3 text-red-300 sm:px-3.5" : "w-10 px-0 text-red-300/70 hover:bg-white/10 hover:text-red-300 sm:w-9"
              }`}
            >
              <ShieldCheck className="h-4 w-4 shrink-0" strokeWidth={2} />
              {adminActive && <span className="animate-nav-label whitespace-nowrap text-[10px] font-semibold leading-none sm:text-xs">Admin</span>}
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
