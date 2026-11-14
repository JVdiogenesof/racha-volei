"use client";

import { useEffect, useState, type ReactNode } from "react";

export type ProfileTab = {
  id: string;
  label: string;
  icon?: ReactNode;
  /** Bolinha de novidade (número ou ponto). */
  badge?: number;
  content: ReactNode;
};

/** Evento pra trocar de aba de qualquer lugar da tela (ex.: "Equipar agora" da comemoração). */
export const PROFILE_TAB_EVENT = "vpa:profile-tab";

export function ProfileTabs({ tabs, initial }: { tabs: ProfileTab[]; initial?: string }) {
  const [active, setActive] = useState(initial && tabs.some((tab) => tab.id === initial) ? initial : tabs[0].id);

  useEffect(() => {
    const onSwitch = (event: Event) => {
      const id = (event as CustomEvent<string>).detail;
      if (tabs.some((tab) => tab.id === id)) {
        setActive(id);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    };
    window.addEventListener(PROFILE_TAB_EVENT, onSwitch);
    return () => window.removeEventListener(PROFILE_TAB_EVENT, onSwitch);
  }, [tabs]);

  return (
    <div>
      <div role="tablist" aria-label="Seções do perfil" className="no-scrollbar  -mx-1 flex gap-1 overflow-x-auto rounded-2xl border border-white/10 bg-[#140c33]/95 p-1">
        {tabs.map((tab) => {
          const selected = tab.id === active;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`perfil-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`perfil-panel-${tab.id}`}
              onClick={() => setActive(tab.id)}
              className={`flex min-h-10 flex-1 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3 text-xs font-bold transition ${
                selected ? "bg-brand-purple text-white shadow-md shadow-purple-950/40" : "text-white/55 hover:bg-white/5 hover:text-white/80"
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.badge ? (
                <span className="rounded-full bg-amber-300 px-1.5 py-0.5 text-[9px] font-black leading-none text-amber-950">{tab.badge}</span>
              ) : null}
            </button>
          );
        })}
      </div>
      {tabs.map((tab) => (
        <div key={tab.id} role="tabpanel" id={`perfil-panel-${tab.id}`} aria-labelledby={`perfil-tab-${tab.id}`} hidden={tab.id !== active} className="pt-5">
          {tab.content}
        </div>
      ))}
    </div>
  );
}
