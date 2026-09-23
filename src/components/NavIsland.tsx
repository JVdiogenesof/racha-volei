"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, CalendarDays, Users, Award, Megaphone, History, Trophy, ShieldCheck, type LucideIcon } from "lucide-react";
import { useCompactHeader } from "@/components/CompactAppHeader";

const LINKS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "Início", icon: Home },
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
}: {
  badgeByHref: Record<string, number>;
  isOrganizer: boolean;
}) {
  const pathname = usePathname();
  const adminActive = isActiveHref(pathname, "/admin");
  const compact = useCompactHeader();
  const itemCount = LINKS.length + (isOrganizer ? 1 : 0);

  return (
    <nav aria-label="Navegação principal" className={`border-t border-white/10 px-3 transition-[padding] duration-300 sm:flex sm:justify-center sm:py-2.5 ${compact ? "py-1.5" : "py-2"}`}>
      <div
        className={`mx-auto grid w-full max-w-lg items-stretch gap-1 border border-white/10 bg-white/5 p-1 transition-all duration-300 sm:inline-flex sm:w-auto sm:max-w-none sm:items-center sm:rounded-full sm:p-1.5 ${compact ? "rounded-full" : "grid-cols-4 rounded-2xl"}`}
        style={compact ? { gridTemplateColumns: `repeat(${itemCount}, minmax(0, 1fr))` } : undefined}
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
              className={`relative flex min-w-0 flex-col items-center justify-center text-white/60 transition-all duration-300 ease-out sm:h-9 sm:min-h-0 sm:shrink-0 sm:flex-row sm:gap-1.5 sm:rounded-full sm:py-0 ${compact ? "min-h-10 gap-0 rounded-full px-0 py-1" : "min-h-14 gap-1 rounded-xl px-1 py-1.5"} ${
                active ? "bg-brand-purple text-white sm:px-3.5" : "hover:bg-white/10 hover:text-white/80 sm:w-9 sm:px-0"
              }`}
            >
              <link.icon className="h-4 w-4 shrink-0" strokeWidth={2} />
              <span className={`text-center text-[10px] leading-tight font-semibold sm:whitespace-nowrap sm:text-xs ${compact ? "hidden" : ""} ${active ? "animate-nav-label sm:inline" : "sm:hidden"}`}>{link.label}</span>
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
            <span className="mx-1 hidden h-5 w-px shrink-0 bg-white/15 sm:block" />
            <Link
              href="/admin/solicitacoes"
              aria-label="Admin"
              aria-current={adminActive ? "page" : undefined}
              className={`flex min-w-0 flex-col items-center justify-center transition-all duration-300 ease-out sm:h-9 sm:min-h-0 sm:shrink-0 sm:flex-row sm:gap-1.5 sm:rounded-full sm:py-0 ${compact ? "min-h-10 gap-0 rounded-full px-0 py-1" : "min-h-14 gap-1 rounded-xl px-1 py-1.5"} ${
                adminActive ? "bg-red-500/20 text-red-300 sm:px-3.5" : "text-red-300/70 hover:bg-white/10 hover:text-red-300 sm:w-9 sm:px-0"
              }`}
            >
              <ShieldCheck className="h-4 w-4 shrink-0" strokeWidth={2} />
              <span className={`text-[10px] font-semibold sm:text-xs ${compact ? "hidden" : ""} ${adminActive ? "animate-nav-label sm:inline" : "sm:hidden"}`}>Admin</span>
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
