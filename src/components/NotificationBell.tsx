"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, UserPlus, CalendarCheck, Users2, Trophy, Rocket, Megaphone, X } from "lucide-react";
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

  return (
    <div className="fixed bottom-5 right-5 z-30">
      {open && (
        <div className="absolute bottom-16 right-0 w-80 max-w-[85vw] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <p className="font-semibold text-brand-navy">Notificações</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md p-1 text-gray-400 hover:bg-gray-100"
              aria-label="Fechar notificações"
            >
              <X className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length ? (
              <ul className="divide-y divide-gray-100">
                {items.map((item) => {
                  const Icon = ICONS[item.type];
                  return (
                    <li key={item.id}>
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className="flex items-start gap-3 px-4 py-3 text-sm hover:bg-gray-50"
                      >
                        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-purple/10 text-brand-purple">
                          <Icon className="h-4 w-4" strokeWidth={2} />
                        </span>
                        <span className="text-brand-navy">{item.message}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="px-4 py-6 text-center text-sm text-gray-500">Tudo em dia por aqui. 🎉</p>
            )}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notificações"
        className="relative flex h-14 w-14 items-center justify-center rounded-full bg-brand-purple text-white shadow-lg hover:bg-brand-purple-dark"
      >
        <Bell className="h-6 w-6" strokeWidth={2} />
        {items.length > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white">
            {items.length > 9 ? "9+" : items.length}
          </span>
        )}
      </button>
    </div>
  );
}
