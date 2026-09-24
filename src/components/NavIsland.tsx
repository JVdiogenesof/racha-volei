"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HeartHandshake, CalendarDays, Users, Award, Megaphone, History, Trophy, ShieldCheck, type LucideIcon } from "lucide-react";
import { useCompactHeader } from "@/components/CompactAppHeader";

const LINKS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/reacoes", label: "Queridômetro", icon: HeartHandshake },
  { href: "/racha", label: "Rachas", icon: CalendarDays },
  { href: "/jogadores", label: "Jogadores", icon: Users },
  { href: "/ranking", label: "Ranking", icon: Award },
  { href: "/torneios-vpa", label: "Torneios VPA", icon: Trophy },
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
  activeHrefOverride,
}: {
  badgeByHref: Record<string, number>;
  isOrganizer: boolean;
  activeHrefOverride?: string;
}) {
  const routePathname = usePathname();
  const pathname = activeHrefOverride ?? routePathname;
  const adminActive = isActiveHref(pathname, "/admin");
  const compact = useCompactHeader();

  return (
    <nav aria-label="Navegação principal" className={`border-t border-white/10 px-2 transition-[padding] duration-300 sm:flex sm:justify-center sm:px-3 ${compact ? "py-1.5 sm:py-2" : "py-2 sm:py-2.5"}`}>
      <div
        className={`no-scrollbar mx-auto flex w-full max-w-full items-center gap-1 overflow-x-auto border border-white/10 bg-black/10 p-1 transition-all duration-300 sm:w-auto sm:max-w-none sm:overflow-visible sm:rounded-full sm:p-1.5 ${compact ? "rounded-full" : "rounded-2xl"}`}
      >
        {LINKS.map((link) => {
          const active = isActiveHref(pathname, link.href);
          const badge = badgeByHref[link.href] ?? 0;
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-label={link.label}
              aria-current={active ? "page" : undefined}
              className={`relative flex shrink-0 items-center justify-center text-white/60 transition-all duration-300 ease-out sm:h-9 sm:min-h-0 sm:flex-row sm:gap-1.5 sm:rounded-full sm:py-0 ${compact ? "h-9 gap-1 rounded-full px-2" : "h-11 flex-col gap-0.5 rounded-xl px-2.5 sm:h-9 sm:flex-row"} ${
                active ? "bg-gradient-to-r from-purple-600 to-violet-500 text-white shadow-md shadow-purple-950/30 sm:px-3.5" : "hover:bg-white/10 hover:text-white/80 sm:w-9 sm:px-0"
              }`}
            >
              <link.icon className="h-4 w-4 shrink-0" strokeWidth={2} />
              <span className={`whitespace-nowrap text-center text-[9px] leading-tight font-semibold sm:text-xs ${compact && !active ? "hidden" : ""} ${active ? "animate-nav-label sm:inline" : "sm:hidden"}`}>{link.label}</span>
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
              aria-current={adminActive ? "page" : undefined}
              className={`flex shrink-0 items-center justify-center transition-all duration-300 ease-out sm:h-9 sm:min-h-0 sm:flex-row sm:gap-1.5 sm:rounded-full sm:py-0 ${compact ? "h-9 gap-1 rounded-full px-2" : "h-11 flex-col gap-0.5 rounded-xl px-2.5 sm:h-9 sm:flex-row"} ${
                adminActive ? "bg-red-500/20 text-red-300 sm:px-3.5" : "text-red-300/70 hover:bg-white/10 hover:text-red-300 sm:w-9 sm:px-0"
              }`}
            >
              <ShieldCheck className="h-4 w-4 shrink-0" strokeWidth={2} />
              <span className={`text-[9px] font-semibold sm:text-xs ${compact && !adminActive ? "hidden" : ""} ${adminActive ? "animate-nav-label sm:inline" : "sm:hidden"}`}>Admin</span>
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
