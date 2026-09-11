import Link from "next/link";
import { CalendarDays, Users, Award, Megaphone, History, type LucideIcon } from "lucide-react";

const LINKS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/racha", label: "Rachas", icon: CalendarDays },
  { href: "/jogadores", label: "Jogadores", icon: Users },
  { href: "/ranking", label: "Ranking", icon: Award },
  { href: "/avisos", label: "Avisos", icon: Megaphone },
  { href: "/historico", label: "Histórico", icon: History },
];

export function QuickAccessRail() {
  return (
    <div className="fixed right-3 top-1/2 z-20 flex -translate-y-1/2 flex-col items-center gap-3.5 rounded-full border border-white/15 bg-brand-navy-light/95 px-2 py-3 shadow-lg">
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          aria-label={link.label}
          title={link.label}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-purple/10 text-purple-300 transition hover:bg-brand-purple/25"
        >
          <link.icon className="h-4 w-4" strokeWidth={2} />
        </Link>
      ))}
    </div>
  );
}
