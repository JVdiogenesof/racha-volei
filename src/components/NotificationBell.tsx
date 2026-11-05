"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, CalendarCheck, Users2, Trophy, Rocket, Megaphone, X } from "lucide-react";
import type { NotificationItem, NotificationType } from "@/lib/notifications";

const ICONS: Record<NotificationType, typeof Bell> = {
  confirm: CalendarCheck,
  teams: Users2,
  mvp: Trophy,
  publish_list: Rocket,
  avisos: Megaphone,
};

/** Sino do cabeçalho, com a lista de notificações. */
export function NotificationBell({ items }: { items: NotificationItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, []);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Notificações"
        aria-expanded={open}
        className={`relative grid h-9 w-9 place-items-center rounded-full border border-white/10 text-white/85 transition hover:bg-white/15 ${open ? "bg-white/20" : "bg-white/[0.08]"}`}
      >
        <Bell className="h-[18px] w-[18px]" strokeWidth={2.2} />
        {items.length > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-black leading-none text-white ring-2 ring-[#261660]">
            {items.length > 9 ? "9+" : items.length}
          </span>
        )}
      </button>

      {open && (
        <div className="animate-toast-in absolute right-0 top-[calc(100%+0.6rem)] z-50 w-80 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-2xl border border-white/15 bg-[#171039]/95 shadow-2xl shadow-black/40 backdrop-blur-xl max-sm:-right-12">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <p className="font-semibold text-white">Notificações</p>
            <button type="button" onClick={() => setOpen(false)} className="rounded-md p-1 text-white/40 hover:bg-white/10" aria-label="Fechar notificações">
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
                      <Link href={item.href} onClick={() => setOpen(false)} className="flex items-start gap-3 px-4 py-3 text-sm hover:bg-white/5">
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
    </div>
  );
}
