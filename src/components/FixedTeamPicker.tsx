"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Lock, X, Check } from "lucide-react";
import { Avatar } from "./Avatar";

type Player = { profileId: string; fullName: string; avatarUrl: string | null };

/**
 * Deixa o organizador reservar um grupo de jogadores pra jogar junto no
 * time 1 (ex: o time campeão do racha passado) -- o resto dos confirmados é
 * balanceado normalmente nos outros times, tanto na simulação quanto na
 * geração oficial.
 */
export function FixedTeamPicker({
  players,
  teamSize,
  selectedIds,
  onChange,
}: {
  players: Player[];
  teamSize: number;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedSet = new Set(selectedIds);
  const atLimit = selectedIds.length >= teamSize;

  function toggle(profileId: string) {
    if (selectedSet.has(profileId)) {
      onChange(selectedIds.filter((id) => id !== profileId));
    } else if (!atLimit) {
      onChange([...selectedIds, profileId]);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Reservar time fixo"
        title={selectedIds.length ? `Time fixo: ${selectedIds.length}/${teamSize}` : "Reservar time fixo"}
        className={`relative flex h-11 w-11 items-center justify-center rounded-full border ${
          selectedIds.length
            ? "border-amber-300/40 bg-amber-400/15 text-amber-200"
            : "border-dashed border-white/25 bg-white/5 text-white/60 hover:bg-white/10"
        }`}
      >
        <Lock className="h-5 w-5" strokeWidth={2} />
        {selectedIds.length > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-400 px-1 text-[9px] font-bold leading-none text-amber-950">
            {selectedIds.length}
          </span>
        )}
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-5"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setOpen(false);
          }}
        >
          <section role="dialog" aria-modal="true" aria-labelledby="fixed-team-title" className="max-h-[84dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-white/15 bg-[#171122] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl sm:p-5">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-3 bg-[#171122]/95 pb-3 backdrop-blur-xl">
              <div>
                <h2 id="fixed-team-title" className="flex items-center gap-2 font-semibold text-white">
                  <Lock className="h-4 w-4 text-amber-300" /> Time fixo
                </h2>
                <p className="mt-0.5 text-xs text-white/45">
                  Escolha até {teamSize} pessoas pra jogar juntas no time 1. O resto dos confirmados é balanceado normalmente.
                </p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Fechar" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-1 text-xs font-semibold text-amber-200">{selectedIds.length}/{teamSize} selecionados</p>

            <ul className="mt-3 space-y-1.5">
              {players.map((player) => {
                const selected = selectedSet.has(player.profileId);
                return (
                  <li key={player.profileId}>
                    <button
                      type="button"
                      onClick={() => toggle(player.profileId)}
                      disabled={!selected && atLimit}
                      className={`flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-40 ${
                        selected ? "border-amber-300/40 bg-amber-400/10 text-white" : "border-white/10 bg-white/[0.02] text-white/75 hover:bg-white/5"
                      }`}
                    >
                      <Avatar src={player.avatarUrl} name={player.fullName} size="sm" />
                      <span className="min-w-0 flex-1 truncate">{player.fullName}</span>
                      {selected && <Check className="h-4 w-4 shrink-0 text-amber-300" strokeWidth={2.5} />}
                    </button>
                  </li>
                );
              })}
              {!players.length && <li className="text-sm text-white/50">Ninguém confirmado ainda.</li>}
            </ul>

            <div className="sticky bottom-0 mt-4 flex gap-2 bg-[#171122]/95 pt-2">
              {selectedIds.length > 0 && (
                <button type="button" onClick={() => onChange([])} className="min-h-10 flex-1 rounded-xl border border-white/15 bg-white/5 text-sm font-semibold text-white/75 hover:bg-white/10">
                  Limpar
                </button>
              )}
              <button type="button" onClick={() => setOpen(false)} className="min-h-10 flex-1 rounded-xl bg-brand-purple text-sm font-bold text-white hover:bg-brand-purple-dark">
                Pronto
              </button>
            </div>
          </section>
        </div>,
        document.body,
      )}
    </>
  );
}
