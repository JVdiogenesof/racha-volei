"use client";

import { type ReactNode, useState } from "react";
import { ListOrdered, Swords, UsersRound } from "lucide-react";

type TabId = "teams" | "matches" | "standings";

export function TeamsWorkspaceTabs({
  teamsContent,
  matchesContent,
  standingsContent,
  teamCount,
  matchCount,
  standingCount,
}: {
  teamsContent: ReactNode;
  matchesContent: ReactNode;
  standingsContent?: ReactNode;
  teamCount: number;
  matchCount: number;
  standingCount: number;
}) {
  const [activeTab, setActiveTab] = useState<TabId>("teams");
  const tabs = [
    { id: "teams" as const, label: "Times", count: teamCount, icon: UsersRound },
    { id: "matches" as const, label: "Confrontos", count: matchCount, icon: Swords },
    ...(standingsContent ? [{ id: "standings" as const, label: "Classificação", count: standingCount, icon: ListOrdered }] : []),
  ];

  return (
    <section>
      <div className="no-scrollbar -mx-1 overflow-x-auto px-1 py-2">
        <div className="mx-auto flex w-max min-w-full items-center gap-1 rounded-2xl border border-white/10 bg-[#171122]/95 p-1 shadow-lg shadow-black/20 sm:min-w-0">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                aria-pressed={active}
                className={`flex min-h-10 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-semibold leading-none transition sm:flex-1 sm:text-sm ${
                  active ? "bg-brand-purple text-white shadow-md shadow-purple-950/30" : "text-white/50 hover:bg-white/5 hover:text-white/80"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" strokeWidth={2} />
                {tab.label}
                <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] leading-none ${active ? "bg-white/15 text-white" : "bg-white/5 text-white/35"}`}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-2">
        {activeTab === "teams" && teamsContent}
        {activeTab === "matches" && matchesContent}
        {activeTab === "standings" && standingsContent}
      </div>
    </section>
  );
}
