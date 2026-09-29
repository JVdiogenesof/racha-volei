"use client";

import { useState } from "react";
import { ShieldCheck, Trophy, UsersRound } from "lucide-react";

const PRE_TORNEIO_TEAMS = 4;

export function RachaCapacityFields({
  defaultNumTeams,
  defaultMaxPlayers,
  defaultTeamSize = 6,
  defaultNewcomerReservedSpots = 0,
  defaultIsPreTorneio = false,
}: {
  defaultNumTeams: number;
  defaultMaxPlayers: number | null;
  defaultTeamSize?: number;
  defaultNewcomerReservedSpots?: number;
  defaultIsPreTorneio?: boolean;
}) {
  const [numTeams, setNumTeams] = useState(defaultNumTeams);
  const [teamSize, setTeamSize] = useState(defaultTeamSize);
  const initialCapacity = defaultNumTeams * defaultTeamSize;
  const [maxPlayers, setMaxPlayers] = useState<number | "">(defaultMaxPlayers ?? initialCapacity);
  const [maxPlayersTouched, setMaxPlayersTouched] = useState(
    defaultMaxPlayers != null && defaultMaxPlayers !== initialCapacity,
  );
  const [isPreTorneio, setIsPreTorneio] = useState(defaultIsPreTorneio);
  const [reserveNewcomerSpots, setReserveNewcomerSpots] = useState(defaultNewcomerReservedSpots > 0);
  const [newcomerReservedSpots, setNewcomerReservedSpots] = useState(
    Math.max(1, defaultNewcomerReservedSpots || 1),
  );

  const teamCapacity = numTeams * teamSize;

  return (
    <>
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

      <div className="sm:col-span-2">
        <label className="flex items-center gap-2 text-sm text-white">
          <input
            type="checkbox"
            name="isPreTorneio"
            checked={isPreTorneio}
            onChange={(e) => {
              const checked = e.target.checked;
              setIsPreTorneio(checked);
              if (checked) {
                setNumTeams(PRE_TORNEIO_TEAMS);
                setTeamSize(6);
                setMaxPlayersTouched(false);
                setMaxPlayers(PRE_TORNEIO_TEAMS * 6);
              }
            }}
            className="h-4 w-4 rounded border-white/15 text-amber-400 focus:ring-amber-400"
          />
          <span className="flex items-center gap-1.5">
            <Trophy className="h-4 w-4 text-amber-400" strokeWidth={2} />
            Racha especial (pré-torneio)
          </span>
        </label>
        <p className="mt-1 text-xs text-white/40">
          Fase de grupos seguida de final entre os 2 primeiros. Ao ativar, sugere 4 sextetos e 24 vagas.
        </p>
      </div>
    </>
  );
}
