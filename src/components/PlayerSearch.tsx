"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Avatar } from "./Avatar";
import { NicknameBadge } from "./NicknameBadge";

type Player = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  is_setter: boolean;
  overall: number;
  streak?: number;
  nickname_badge?: string | null;
};

export function PlayerSearch({ players }: { players: Player[] }) {
  const [query, setQuery] = useState("");

  const filtered = players.filter((p) =>
    p.full_name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <div>
      <div className="relative mt-6 max-w-sm">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40"
          strokeWidth={2}
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar jogador pelo nome..."
          className="w-full rounded-lg border border-white/15 py-2 pl-9 pr-3 text-sm focus:border-brand-purple focus:outline-none focus:ring-1 focus:ring-brand-purple"
        />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((p) => (
          <div key={p.id} className="flex items-center gap-4 rounded-xl border border-white/10 p-4">
            <Avatar src={p.avatar_url} name={p.full_name} size="lg" streak={p.streak} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-white">{p.full_name}</p>
              <NicknameBadge text={p.nickname_badge} className="mt-1" />
              {p.is_setter && <p className="mt-1 text-xs text-white/60">🏐 Levantador(a)</p>}
              <div className="mt-1.5 h-1.5 w-full rounded-full bg-white/10">
                <div
                  className="h-1.5 rounded-full bg-brand-purple"
                  style={{ width: `${Math.min(100, (p.overall / 5) * 100)}%` }}
                />
              </div>
            </div>
            <span className="shrink-0 text-lg font-semibold text-purple-300">
              {p.overall.toFixed(1)}
            </span>
          </div>
        ))}
        {!filtered.length && (
          <p className="text-sm text-white/60 sm:col-span-2 lg:col-span-3">
            Nenhum jogador encontrado com esse nome.
          </p>
        )}
      </div>
    </div>
  );
}
