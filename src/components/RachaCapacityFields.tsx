"use client";

import { useState } from "react";
import { ChevronDown, ListChecks, Medal, Settings2, ShieldCheck, Trophy, UsersRound } from "lucide-react";
import { eventGameStyleFromFlags, type EventGameStyle } from "@/lib/eventGameStyle";

const PRE_TORNEIO_TEAMS = 4;

export function RachaCapacityFields({
  defaultNumTeams,
  defaultMaxPlayers,
  defaultTeamSize = 6,
  defaultNewcomerReservedSpots = 0,
  defaultIsPreTorneio = false,
  defaultIsMiniTorneio = false,
}: {
  defaultNumTeams: number;
  defaultMaxPlayers: number | null;
  defaultTeamSize?: number;
  defaultNewcomerReservedSpots?: number;
  defaultIsPreTorneio?: boolean;
  defaultIsMiniTorneio?: boolean;
}) {
  const [numTeams, setNumTeams] = useState(defaultNumTeams);
  const [teamSize, setTeamSize] = useState(defaultTeamSize);
  const initialCapacity = defaultNumTeams * defaultTeamSize;
  const [maxPlayers, setMaxPlayers] = useState<number | "">(defaultMaxPlayers ?? initialCapacity);
  const [maxPlayersTouched, setMaxPlayersTouched] = useState(
    defaultMaxPlayers != null && defaultMaxPlayers !== initialCapacity,
  );
  const [gameStyle, setGameStyle] = useState<EventGameStyle>(
    eventGameStyleFromFlags(defaultIsPreTorneio, defaultIsMiniTorneio),
  );
  const [reserveNewcomerSpots, setReserveNewcomerSpots] = useState(defaultNewcomerReservedSpots > 0);
  const [newcomerReservedSpots, setNewcomerReservedSpots] = useState(
    Math.max(1, defaultNewcomerReservedSpots || 1),
  );
  // Só abre sozinho quando já tem algo fora do padrão -- senão fica
  // escondido, que é o caso comum (racha casual, sem vaga protegida).
  const [showAdvanced, setShowAdvanced] = useState(gameStyle !== "casual" || reserveNewcomerSpots);

  const teamCapacity = numTeams * teamSize;
  const chosenCapacity = typeof maxPlayers === "number" ? maxPlayers : teamCapacity;
  const setterReservedSpots = Math.max(1, Math.ceil(chosenCapacity / 6));
  const maxNewcomerReservedSpots = Math.max(0, chosenCapacity - setterReservedSpots);

  function selectGameStyle(style: EventGameStyle) {
    setGameStyle(style);
    if (style === "pre_tournament") {
      setNumTeams(PRE_TORNEIO_TEAMS);
      setTeamSize(6);
      setMaxPlayersTouched(false);
      setMaxPlayers(PRE_TORNEIO_TEAMS * 6);
    } else if (style === "mini_tournament" && numTeams < 4) {
      setNumTeams(4);
      setMaxPlayersTouched(false);
      setMaxPlayers(4 * teamSize);
    }
  }

  const gameStyleLabel = gameStyle === "pre_tournament" ? "Pré-torneio" : gameStyle === "mini_tournament" ? "Mini torneio" : null;

  return (
    <>
      {/* Sempre no form, mesmo com a seção "Mais opções" fechada visualmente
          (hidden só tira da tela, não desmonta -- o valor continua indo no submit). */}
      <input type="hidden" name="gameStyle" value={gameStyle} />
      {!reserveNewcomerSpots && <input type="hidden" name="newcomerReservedSpots" value="0" />}

      <div className="sm:col-span-2 rounded-xl border border-white/10 bg-white/[0.035] p-4">
        <div className="flex items-center gap-2">
          <UsersRound className="h-4 w-4 shrink-0 text-purple-300" strokeWidth={2} />
          <p className="text-sm font-semibold text-white">Times e vagas</p>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          {[
            { size: 3, label: "Trio" },
            { size: 4, label: "Quarteto" },
            { size: 6, label: "Sexteto" },
          ].map((option) => (
            <label
              key={option.size}
              className={`min-w-0 cursor-pointer rounded-lg border px-2 py-3 text-center transition ${
                teamSize === option.size
                  ? "border-purple-300/60 bg-brand-purple/30 text-white"
                  : "border-white/10 bg-white/5 text-white/55 hover:bg-white/10"
              }`}
            >
              <input
                type="radio"
                name="teamSize"
                value={option.size}
                checked={teamSize === option.size}
                onChange={() => {
                  setTeamSize(option.size);
                  setMaxPlayersTouched(false);
                  setMaxPlayers(numTeams * option.size);
                }}
                className="sr-only"
              />
              <span className="block truncate text-sm font-semibold">{option.label}</span>
              <span className="mt-0.5 block text-[11px] text-white/45">{option.size} por time</span>
            </label>
          ))}
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="min-w-0">
            <label className="block text-sm font-medium text-white">Número de times</label>
            <input
              type="number"
              name="numTeams"
              value={numTeams}
              min={2}
              required
              onChange={(e) => {
                const value = Number(e.target.value);
                setNumTeams(value);
                if (!maxPlayersTouched) setMaxPlayers(value * teamSize);
              }}
              className="mt-1 w-full min-w-0 rounded-lg border border-white/15 px-3 py-2"
            />
          </div>
          <div className="min-w-0">
            <label className="block truncate text-sm font-medium text-white">
              Vagas <span className="text-white/40">(máx. {teamCapacity})</span>
            </label>
            <input
              type="number"
              name="maxPlayers"
              value={maxPlayers}
              min={1}
              max={teamCapacity}
              required
              onChange={(e) => {
                setMaxPlayersTouched(true);
                setMaxPlayers(e.target.value === "" ? "" : Number(e.target.value));
              }}
              className="mt-1 w-full min-w-0 rounded-lg border border-white/15 px-3 py-2"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          aria-expanded={showAdvanced}
          className="mt-3 flex min-w-0 items-center gap-1.5 text-xs font-semibold text-purple-300 hover:text-purple-200"
        >
          <Settings2 className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
          <span className="truncate">Mais opções{gameStyleLabel ? ` · ${gameStyleLabel}` : ""}{reserveNewcomerSpots ? " · Vagas pra novatos" : ""}</span>
          <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform ${showAdvanced ? "rotate-180" : ""}`} strokeWidth={2} />
        </button>

        <div className={showAdvanced ? "mt-3 space-y-3 border-t border-white/10 pt-3" : "hidden"}>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-white/70">Estilo dos jogos</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {[
                {
                  value: "casual" as const,
                  label: "Jogos avulsos",
                  description: "Escolhe cada confronto livremente.",
                  icon: ListChecks,
                  activeClass: "border-purple-300/60 bg-brand-purple/25",
                },
                {
                  value: "mini_tournament" as const,
                  label: "Mini torneio",
                  description: "Todos contra todos, jogo dos últimos e final.",
                  icon: Medal,
                  activeClass: "border-cyan-300/60 bg-cyan-400/10",
                },
                {
                  value: "pre_tournament" as const,
                  label: "Pré-torneio",
                  description: "Formato especial com classificação e vaga VPA.",
                  icon: Trophy,
                  activeClass: "border-amber-300/60 bg-amber-400/10",
                },
              ].map((option) => {
                const Icon = option.icon;
                const active = gameStyle === option.value;
                return (
                  <button
                    type="button"
                    key={option.value}
                    aria-pressed={active}
                    onClick={() => selectGameStyle(option.value)}
                    className={`min-w-0 cursor-pointer rounded-xl border p-3 text-left transition active:scale-[0.98] ${
                      active ? option.activeClass : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
                    }`}
                  >
                    <span className="flex items-center gap-2 text-sm font-bold text-white">
                      <Icon className="h-4 w-4 shrink-0" strokeWidth={2} />
                      <span className="truncate">{option.label}</span>
                    </span>
                    <span className="mt-1.5 block text-xs leading-relaxed text-white/50">{option.description}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="min-w-0 rounded-xl border border-cyan-300/15 bg-cyan-400/5 p-3.5">
            <label className="flex cursor-pointer items-start gap-3 text-sm text-white">
              <input
                type="checkbox"
                checked={reserveNewcomerSpots}
                onChange={(e) => setReserveNewcomerSpots(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/15 text-cyan-400 focus:ring-cyan-400"
              />
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 font-semibold">
                  <ShieldCheck className="h-4 w-4 shrink-0 text-cyan-300" strokeWidth={2} />
                  Proteger vagas para novatos
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-white/45">
                  Só pessoas chamadas da reserva pra este racha ocupam essas vagas. Além delas, o sistema protege {setterReservedSpots} vaga{setterReservedSpots === 1 ? "" : "s"} para levantadores.
                </span>
              </span>
            </label>
            {reserveNewcomerSpots && (
              <div className="mt-3 max-w-xs min-w-0">
                <label className="block text-xs font-medium text-white/65">Quantidade protegida</label>
                <input
                  type="number"
                  name="newcomerReservedSpots"
                  value={newcomerReservedSpots}
                  min={1}
                  max={maxNewcomerReservedSpots}
                  required
                  onChange={(e) => setNewcomerReservedSpots(Number(e.target.value))}
                  className="mt-1 w-full min-w-0 rounded-lg border border-white/15 px-3 py-2"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
