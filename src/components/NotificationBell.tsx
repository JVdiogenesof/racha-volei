"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, UserPlus, CalendarCheck, Users2, Trophy, Rocket, Megaphone, X, Swords, TrendingUp } from "lucide-react";
import type { NotificationItem, NotificationType } from "@/lib/notifications";

const ICONS: Record<NotificationType, typeof Bell> = {
  admin_pending: UserPlus,
  confirm: CalendarCheck,
  teams: Users2,
  mvp: Trophy,
  publish_list: Rocket,
  avisos: Megaphone,
};

export function NotificationBell({ items }: { items: NotificationItem[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-1/2 z-30 -translate-x-1/2">
      {open && (
        <div className="animate-toast-in absolute bottom-[calc(100%+0.75rem)] left-1/2 w-80 max-w-[calc(100vw-2rem)] -translate-x-1/2 overflow-hidden rounded-2xl border border-white/10 bg-brand-navy-light shadow-2xl shadow-black/40">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <p className="font-semibold text-white">Notificações</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md p-1 text-white/40 hover:bg-white/10"
              aria-label="Fechar notificações"
            >
              <X className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length ? (
              <ul className="divide-y divide-white/10">
                {items.map((item) => {
                  const Icon = ICONS[item.type];
                  return (
                    <li key={item.id}>
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className="flex items-start gap-3 px-4 py-3 text-sm hover:bg-white/5"
                      >
                        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-purple/10 text-purple-300">
                          <Icon className="h-4 w-4" strokeWidth={2} />
                        </span>
                        <span className="text-white">{item.message}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="px-4 py-6 text-center text-sm text-white/60">Tudo em dia por aqui. 🎉</p>
            )}
          </div>
        </div>
      )}

      <nav
        aria-label="Atalhos pessoais"
        className="flex items-center gap-1 rounded-full border border-white/15 bg-brand-navy/90 p-1.5 shadow-2xl shadow-black/40 backdrop-blur-xl"
      >
        <IslandLink href="/reacoes" label="Reações" active={pathname.startsWith("/reacoes")}>
          <Swords className="h-5 w-5" strokeWidth={2} />
        </IslandLink>
        <IslandLink href="/evolucao" label="Minha evolução" active={pathname.startsWith("/evolucao")}>
          <TrendingUp className="h-5 w-5" strokeWidth={2} />
        </IslandLink>
        <span aria-hidden className="mx-0.5 h-6 w-px bg-white/15" />
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-label="Notificações"
          aria-expanded={open}
          className={`relative flex h-11 w-11 items-center justify-center rounded-full text-white transition-colors hover:bg-brand-purple-dark ${open ? "bg-brand-purple" : "bg-white/5"}`}
        >
          <Bell className="h-5 w-5" strokeWidth={2} />
          {items.length > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-brand-navy">
              {items.length > 9 ? "9+" : items.length}
            </span>
          )}
        </button>
      </nav>
    </div>
  );
}

function IslandLink({
  href,
  label,
  active,
  children,
}: {
  href: string;
  label: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      aria-current={active ? "page" : undefined}
      className={`flex h-11 w-11 items-center justify-center rounded-full text-white transition-colors hover:bg-brand-purple-dark ${active ? "bg-brand-purple" : "bg-white/5"}`}
    >
      {children}
    </Link>
  );
}
