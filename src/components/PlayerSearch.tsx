"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronRight, Flame, Gauge, Search, Trophy, UsersRound, X } from "lucide-react";
import { Avatar } from "./Avatar";
import { NicknameBadge } from "./NicknameBadge";
import { AchievementDetailsModal } from "./AchievementDetailsModal";
import type { Achievement } from "@/lib/achievements";

type Player = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  is_setter: boolean;
  overall: number;
  streak?: number;
  nickname_badge?: string | null;
  achievements: Achievement[];
  achievementCount: number;
  performance: { wins: number; losses: number; matches: number; percentage: number } | null;
};

type Filter = "all" | "setters" | "achievements";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "setters", label: "Levantadores" },
  { id: "achievements", label: "Com conquistas" },
];

function PlayerDetails({
  player,
  rank,
  onClose,
  onAchievementClick,
}: {
  player: Player;
  rank: number;
  onClose: () => void;
  onAchievementClick: (achievement: Achievement) => void;
}) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  const performance = player.performance;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-2 backdrop-blur-sm sm:items-center sm:p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="player-dialog-title"
        className="animate-toast-in max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-[1.75rem] border border-white/15 bg-gradient-to-b from-[#30215d] via-[#1d173c] to-[#111329] p-5 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative">
              <Avatar src={player.avatar_url} name={player.full_name} size="lg" streak={player.streak} />
              <span className="absolute -left-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-[#30215d] bg-white px-1 text-[10px] font-black text-brand-navy">
                {rank}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-purple-300">Perfil do jogador</p>
              <h2 id="player-dialog-title" className="truncate text-xl font-black text-white">{player.full_name}</h2>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <NicknameBadge text={player.nickname_badge} />
                {player.is_setter ? (
                  <span className="rounded-full border border-sky-300/20 bg-sky-300/10 px-2 py-0.5 text-[10px] font-bold text-sky-200">🏐 Levantador(a)</span>
                ) : null}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar detalhes do jogador"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/8 text-white/60 transition hover:bg-white/15 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2">
          <div className="rounded-2xl border border-purple-300/15 bg-purple-300/8 p-3 text-center">
            <Gauge className="mx-auto h-4 w-4 text-purple-300" />
            <strong className="mt-1 block text-xl text-white">{player.overall.toFixed(1)}</strong>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-white/45">Nota geral</span>
          </div>
          <div className="rounded-2xl border border-emerald-300/15 bg-emerald-300/8 p-3 text-center">
            <UsersRound className="mx-auto h-4 w-4 text-emerald-300" />
            <strong className="mt-1 block text-xl text-white">{performance ? `${performance.percentage}%` : "—"}</strong>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-white/45">Aproveit.</span>
          </div>
          <div className="rounded-2xl border border-amber-300/15 bg-amber-300/8 p-3 text-center">
            <Trophy className="mx-auto h-4 w-4 text-amber-300" />
            <strong className="mt-1 block text-xl text-white">{player.achievementCount}</strong>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-white/45">Conquistas</span>
          </div>
        </div>

        <div className="mt-3 rounded-2xl border border-white/8 bg-black/15 p-4">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-white/60">Evolução da nota</span>
            <span className="font-bold text-purple-200">{player.overall.toFixed(1)} de 5</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-purple to-fuchsia-300"
              style={{ width: `${Math.min(100, (player.overall / 5) * 100)}%` }}
            />
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-white/40">Nota combinada entre autoavaliação e avaliação dos organizadores.</p>
        </div>

        {performance ? (
          <div className="mt-3 rounded-2xl border border-white/8 bg-black/15 p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-white">Desempenho nos confrontos</h3>
              <span className="rounded-full bg-emerald-300/10 px-2 py-1 text-[10px] font-bold text-emerald-200">
                {performance.matches} {performance.matches === 1 ? "jogo" : "jogos"}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-center">
              <div className="rounded-xl bg-emerald-400/8 px-3 py-2">
                <strong className="block text-lg text-emerald-300">{performance.wins}</strong>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-white/40">Vitórias</span>
              </div>
              <div className="rounded-xl bg-rose-400/8 px-3 py-2">
                <strong className="block text-lg text-rose-300">{performance.losses}</strong>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-white/40">Derrotas</span>
              </div>
            </div>
          </div>
        ) : null}

        <div className="mt-3 rounded-2xl border border-white/8 bg-black/15 p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-bold text-white">
              <Trophy className="h-4 w-4 text-amber-300" /> Conquistas em destaque
            </h3>
            <span className="text-xs font-bold text-white/45">{player.achievementCount} no total</span>
          </div>
          {player.achievements.length > 0 ? (
            <div className="mt-3 space-y-2">
              {player.achievements.map((achievement) => (
                <button
                  type="button"
                  key={achievement.id}
                  onClick={() => onAchievementClick(achievement)}
                  className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-amber-300/10 bg-amber-300/6 px-3 py-2 text-left transition hover:border-amber-300/25 hover:bg-amber-300/10"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-300/10 text-lg">{achievement.emoji}</span>
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-xs text-white">{achievement.title}</strong>
                    <span className="block truncate text-[10px] text-white/40">Toque para ver os detalhes</span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-white/25" />
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-xs leading-relaxed text-white/40">As conquistas aparecem aqui conforme o jogador participa e vence rachas.</p>
          )}
        </div>

        {player.streak && player.streak > 0 ? (
          <p className="mt-3 flex items-center justify-center gap-1.5 text-xs font-semibold text-orange-200/80">
            <Flame className="h-4 w-4" />
            {player.streak} {player.streak === 1 ? "racha seguido" : "rachas seguidos"}
          </p>
        ) : null}
      </section>
    </div>,
    document.body,
  );
}

export function PlayerSearch({ players }: { players: Player[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [selectedAchievement, setSelectedAchievement] = useState<{ achievement: Achievement; ownerName: string } | null>(null);

  const rankById = useMemo(() => new Map(players.map((player, index) => [player.id, index + 1])), [players]);
  const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
  const filtered = useMemo(
    () => players.filter((player) => {
      const matchesQuery = player.full_name.toLocaleLowerCase("pt-BR").includes(normalizedQuery);
      const matchesFilter = filter === "all" || (filter === "setters" && player.is_setter) || (filter === "achievements" && player.achievementCount > 0);
      return matchesQuery && matchesFilter;
    }),
    [filter, normalizedQuery, players],
  );

  return (
    <div className="mt-5">
      <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
        <div className="flex items-center gap-2">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Buscar jogador pelo nome</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" strokeWidth={2} />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar jogador..."
              className="h-11 w-full rounded-xl border border-white/10 bg-black/15 pl-9 pr-3 text-sm text-white placeholder:text-white/35 focus:border-purple-300/50 focus:outline-none focus:ring-2 focus:ring-purple-400/10"
            />
          </label>
          <span className="flex h-11 min-w-11 shrink-0 items-center justify-center rounded-xl bg-purple-300/10 px-3 text-sm font-black text-purple-200">{filtered.length}</span>
        </div>
        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {FILTERS.map((item) => (
            <button
              type="button"
              key={item.id}
              onClick={() => setFilter(item.id)}
              aria-pressed={filter === item.id}
              className={`min-h-9 shrink-0 rounded-full px-3 text-xs font-bold transition ${filter === item.id ? "bg-white text-brand-navy" : "border border-white/10 bg-white/5 text-white/55 hover:bg-white/10 hover:text-white"}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((player) => {
          const rank = rankById.get(player.id) ?? 0;
          return (
            <button
              type="button"
              key={player.id}
              onClick={() => setSelectedPlayer(player)}
              aria-label={`Ver perfil de ${player.full_name}`}
              className="group relative flex min-h-[5.5rem] min-w-0 items-center gap-3 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.075] to-white/[0.025] p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-purple-300/25 hover:bg-white/[0.09] active:translate-y-0"
            >
              <span className="absolute inset-y-3 left-0 w-0.5 rounded-r-full bg-gradient-to-b from-purple-300 to-brand-purple opacity-50 transition group-hover:opacity-100" />
              <div className="relative shrink-0">
                <Avatar src={player.avatar_url} name={player.full_name} size="lg" streak={player.streak} />
                <span className="absolute -left-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-[#1a1836] bg-white px-1 text-[10px] font-black text-brand-navy">{rank}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-white">{player.full_name}</p>
                <div className="mt-1 flex min-w-0 items-center gap-1.5">
                  <NicknameBadge text={player.nickname_badge} />
                  {player.is_setter ? <span className="shrink-0 rounded-full bg-sky-300/10 px-2 py-0.5 text-[9px] font-bold text-sky-200">🏐 Lev.</span> : null}
                </div>
                <div className="mt-2 flex items-center gap-2 text-[10px] font-semibold text-white/40">
                  <span>{player.performance ? `${player.performance.percentage}% aproveit.` : "Sem confrontos"}</span>
                  {player.achievementCount > 0 ? (
                    <><span className="h-1 w-1 rounded-full bg-white/20" /><span className="text-amber-200/70">🏆 {player.achievementCount}</span></>
                  ) : null}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <div className="text-right">
                  <strong className="block text-xl leading-none text-purple-200">{player.overall.toFixed(1)}</strong>
                  <span className="text-[8px] font-bold uppercase tracking-[0.14em] text-white/30">Geral</span>
                </div>
                <ChevronRight className="h-4 w-4 text-white/20 transition group-hover:translate-x-0.5 group-hover:text-purple-200" />
              </div>
            </button>
          );
        })}
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 px-4 py-10 text-center sm:col-span-2 lg:col-span-3">
            <Search className="mx-auto h-5 w-5 text-white/25" />
            <p className="mt-2 text-sm font-semibold text-white/55">Nenhum jogador encontrado</p>
            <p className="mt-1 text-xs text-white/35">Tente outro nome ou escolha o filtro Todos.</p>
          </div>
        ) : null}
      </div>

      {selectedPlayer ? (
        <PlayerDetails
          player={selectedPlayer}
          rank={rankById.get(selectedPlayer.id) ?? 0}
          onClose={() => setSelectedPlayer(null)}
          onAchievementClick={(achievement) => {
            setSelectedPlayer(null);
            setSelectedAchievement({ achievement, ownerName: selectedPlayer.full_name });
          }}
        />
      ) : null}
      {selectedAchievement ? (
        <AchievementDetailsModal achievement={selectedAchievement.achievement} ownerName={selectedAchievement.ownerName} onClose={() => setSelectedAchievement(null)} />
      ) : null}
    </div>
  );
}
