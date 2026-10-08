"use client";

import { useState } from "react";
import { ListChecks, Medal, ShieldCheck, Trophy, UsersRound } from "lucide-react";
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

  const teamCapacity = numTeams * teamSize;

  return (
    <>
      <fieldset className="sm:col-span-2 rounded-xl border border-purple-300/15 bg-purple-400/5 p-4">
        <legend className="px-1 text-sm font-semibold text-white">Estilo dos jogos</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {[
            {
              value: "casual" as const,
              label: "Jogos avulsos",
              description: "Escolha cada confronto livremente.",
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
              <label
                key={option.value}
                className={`cursor-pointer rounded-xl border p-3 transition active:scale-[0.98] ${
                  active ? option.activeClass : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
                }`}
              >
                <input
                  type="radio"
                  name="gameStyle"
                  value={option.value}
                  checked={active}
                  onChange={() => {
                    setGameStyle(option.value);
                    if (option.value === "pre_tournament") {
                      setNumTeams(PRE_TORNEIO_TEAMS);
                      setTeamSize(6);
                      setMaxPlayersTouched(false);
                      setMaxPlayers(PRE_TORNEIO_TEAMS * 6);
                    } else if (option.value === "mini_tournament" && numTeams < 4) {
                      setNumTeams(4);
                      setMaxPlayersTouched(false);
                      setMaxPlayers(4 * teamSize);
                    }
                  }}
                  className="sr-only"
                />
                <span className="flex items-center gap-2 text-sm font-bold text-white">
                  <Icon className="h-4 w-4" strokeWidth={2} />
                  {option.label}
                </span>
                <span className="mt-1.5 block text-xs leading-relaxed text-white/50">{option.description}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="sm:col-span-2 rounded-xl border border-purple-300/15 bg-purple-400/5 p-4">
        <div className="flex items-center gap-2">
          <UsersRound className="h-4 w-4 text-purple-300" strokeWidth={2} />
          <p className="text-sm font-semibold text-white">Formato dos times</p>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[
            { size: 3, label: "Trio" },
            { size: 4, label: "Quarteto" },
            { size: 6, label: "Sexteto" },
          ].map((option) => (
            <label
              key={option.size}
              className={`cursor-pointer rounded-lg border px-2 py-3 text-center transition ${
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
              <span className="block text-sm font-semibold">{option.label}</span>
              <span className="mt-0.5 block text-[11px] text-white/45">{option.size} por time</span>
            </label>
          ))}
        </div>
      </div>

      <div>
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
          className="mt-1 w-full rounded-lg border border-white/15 px-3 py-2"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-white">
          Vagas de confirmados <span className="text-white/40">(máximo: {teamCapacity})</span>
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
          className="mt-1 w-full rounded-lg border border-white/15 px-3 py-2"
        />
        <p className="mt-1 text-xs text-white/40">
          O padrão é {numTeams} times com {teamSize} jogadores. Você pode reduzir as vagas, mas não ultrapassar {teamCapacity}.
        </p>
      </div>

      <div className="sm:col-span-2 rounded-xl border border-cyan-300/15 bg-cyan-400/5 p-4">
        <label className="flex cursor-pointer items-start gap-3 text-sm text-white">
          <input
            type="checkbox"
            checked={reserveNewcomerSpots}
            onChange={(e) => setReserveNewcomerSpots(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-white/15 text-cyan-400 focus:ring-cyan-400"
          />
          <span>
            <span className="flex items-center gap-1.5 font-semibold">
              <ShieldCheck className="h-4 w-4 text-cyan-300" strokeWidth={2} />
              Proteger vagas para novatos
            </span>
            <span className="mt-1 block text-xs text-white/45">
              Essas vagas só podem ser ocupadas por pessoas chamadas da lista de reserva para este racha.
            </span>
          </span>
        </label>
        {reserveNewcomerSpots ? (
          <div className="mt-3 max-w-xs">
            <label className="block text-xs font-medium text-white/65">Quantidade protegida</label>
            <input
              type="number"
              name="newcomerReservedSpots"
              value={newcomerReservedSpots}
              min={1}
              max={typeof maxPlayers === "number" ? maxPlayers : teamCapacity}
              required
              onChange={(e) => setNewcomerReservedSpots(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-white/15 px-3 py-2"
            />
          </div>
        ) : (
          <input type="hidden" name="newcomerReservedSpots" value="0" />
        )}
      </div>

    </>
  );
}
