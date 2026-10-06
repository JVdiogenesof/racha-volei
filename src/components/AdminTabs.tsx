"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SlidersHorizontal, CalendarPlus, Award, Phone, BarChart3, Shirt, WalletCards } from "lucide-react";

const TABS = [
  { href: "/admin/jogadores", label: "Notas dos jogadores", icon: SlidersHorizontal },
  { href: "/admin/rachas", label: "Criar racha", icon: CalendarPlus },
  { href: "/admin/ranking", label: "Rankings", icon: Award },
  { href: "/admin/reserva", label: "Cadastros e reserva", icon: Phone },
  { href: "/admin/camisas", label: "Pedidos das camisas", icon: Shirt },
  { href: "/admin/financas", label: "Finanças", icon: WalletCards },
  { href: "/admin/resumo", label: "Resumo mensal", icon: BarChart3 },
];

export function AdminTabs({ canViewShirts = false }: { canViewShirts?: boolean }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Administração" className="mb-6 grid grid-cols-2 gap-1 border-b border-white/10 sm:flex sm:flex-wrap">
      {TABS.filter((tab) => tab.href !== "/admin/camisas" || canViewShirts).map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-12 min-w-0 items-center gap-2 border-b-2 px-2 py-2.5 text-xs font-medium leading-tight transition sm:min-h-0 sm:px-3 sm:text-sm ${
              active
                ? "border-brand-purple text-purple-300"
                : "border-transparent text-white/60 hover:text-white"
            }`}
          >
            <tab.icon className="h-4 w-4 shrink-0" strokeWidth={2} />
            <span className="min-w-0 text-balance">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
