"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Award, CalendarPlus, LayoutDashboard, Phone, Shirt, SlidersHorizontal, WalletCards, BarChart3, UserRoundX } from "lucide-react";

const TABS = [
  { href: "/admin", label: "Painel", icon: LayoutDashboard, exact: true },
  { href: "/admin/reserva", label: "Cadastros", icon: Phone },
  { href: "/admin/rachas", label: "Rachas", icon: CalendarPlus },
  { href: "/admin/jogadores", label: "Notas", icon: SlidersHorizontal },
  { href: "/admin/atividade", label: "Atividade", icon: UserRoundX },
  { href: "/admin/ranking", label: "Rankings", icon: Award },
  { href: "/admin/financas", label: "Finanças", icon: WalletCards },
  { href: "/admin/camisas", label: "Camisas", icon: Shirt },
  { href: "/admin/resumo", label: "Resumo", icon: BarChart3 },
];

export function AdminTabs({
  canViewShirts = false,
  badges = {},
}: {
  canViewShirts?: boolean;
  /** Contadores de pendências por rota, mostrados ao lado do nome da aba. */
  badges?: Record<string, number>;
}) {
  const pathname = usePathname();

  return (
    <nav aria-label="Administração" className="no-scrollbar mb-4 flex gap-1 overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.03] p-1">
      {TABS.filter((tab) => tab.href !== "/admin/camisas" || canViewShirts).map((tab) => {
        const active = tab.exact ? pathname === tab.href : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        const badge = badges[tab.href] ?? 0;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-semibold leading-none transition ${
              active ? "bg-brand-purple text-white shadow-md shadow-purple-950/30" : "text-white/45 hover:bg-white/5 hover:text-white/75"
            }`}
          >
            <tab.icon className="h-4 w-4 shrink-0" strokeWidth={2.25} />
            {tab.label}
            {badge > 0 && (
              <span className="rounded-full bg-amber-300 px-1.5 py-0.5 text-[9px] font-black text-amber-950">{badge > 99 ? "99+" : badge}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
