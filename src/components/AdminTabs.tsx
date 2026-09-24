"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserCheck, SlidersHorizontal, CalendarPlus, Award, Phone, BarChart3, HeartHandshake } from "lucide-react";

const TABS = [
  { href: "/admin/solicitacoes", label: "Solicitações", icon: UserCheck },
  { href: "/admin/jogadores", label: "Notas dos jogadores", icon: SlidersHorizontal },
  { href: "/admin/rachas", label: "Criar racha", icon: CalendarPlus },
  { href: "/admin/ranking", label: "Rankings", icon: Award },
  { href: "/admin/reserva", label: "Lista de reserva", icon: Phone },
  { href: "/admin/resumo", label: "Resumo mensal", icon: BarChart3 },
  { href: "/admin/reacoes", label: "Queridômetro", icon: HeartHandshake },
];

export function AdminTabs() {
  const pathname = usePathname();

  return (
    <nav aria-label="Administração" className="mb-6 grid grid-cols-2 gap-1 border-b border-white/10 sm:flex sm:flex-wrap">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`flex min-w-0 items-center gap-1.5 border-b-2 px-2 py-2.5 text-xs font-medium transition sm:px-3 sm:text-sm ${
              active
                ? "border-brand-purple text-purple-300"
                : "border-transparent text-white/60 hover:text-white"
            }`}
          >
            <tab.icon className="h-4 w-4 shrink-0" strokeWidth={2} />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
