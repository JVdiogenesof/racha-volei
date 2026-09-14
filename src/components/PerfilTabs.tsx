"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, IdCard, SlidersHorizontal, Bell } from "lucide-react";

const TABS = [
  { href: "/perfil", label: "Visão geral", icon: LayoutDashboard },
  { href: "/perfil/dados", label: "Dados pessoais", icon: IdCard },
  { href: "/perfil/autoavaliacao", label: "Autoavaliação", icon: SlidersHorizontal },
  { href: "/perfil/notificacoes", label: "Notificações", icon: Bell },
];

export function PerfilTabs() {
  const pathname = usePathname();

  return (
    <nav className="mb-6 flex gap-1 overflow-x-auto border-b border-white/10">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition ${
              active
                ? "border-brand-purple text-purple-300"
                : "border-transparent text-white/60 hover:text-white"
            }`}
          >
            <tab.icon className="h-4 w-4" strokeWidth={2} />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
