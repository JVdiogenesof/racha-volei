"use client";

import { useState } from "react";

const PLAYERS_PER_TEAM = 6;

export function RachaCapacityFields({
  defaultNumTeams,
  defaultMaxPlayers,
}: {
  defaultNumTeams: number;
  defaultMaxPlayers: number | null;
}) {
  const [numTeams, setNumTeams] = useState(defaultNumTeams);
  const [maxPlayers, setMaxPlayers] = useState<number | "">(
    defaultMaxPlayers ?? defaultNumTeams * PLAYERS_PER_TEAM,
  );
  // Depois que o organizador mexe direto no campo de vagas, para de
  // recalcular sozinho quando o número de times mudar -- assim ele pode
  // fugir do padrão de 6 por time sem a gente sobrescrever a escolha dele.
  const [maxPlayersTouched, setMaxPlayersTouched] = useState(defaultMaxPlayers != null);

  return (
    <>
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
            if (!maxPlayersTouched) setMaxPlayers(value * PLAYERS_PER_TEAM);
          }}
          className="mt-1 w-full rounded-lg border border-white/15 px-3 py-2"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-white">
          Vagas de confirmados <span className="text-white/40">(sugestão: {PLAYERS_PER_TEAM} por time)</span>
        </label>
        <input
          type="number"
          name="maxPlayers"
          value={maxPlayers}
          min={1}
          onChange={(e) => {
            setMaxPlayersTouched(true);
            setMaxPlayers(e.target.value === "" ? "" : Number(e.target.value));
          }}
          className="mt-1 w-full rounded-lg border border-white/15 px-3 py-2"
        />
        <p className="mt-1 text-xs text-white/40">
          Aparece pra todo mundo na tela do racha (&ldquo;X confirmados de Y vagas&rdquo;). Apague pra deixar sem limite.
        </p>
      </div>
    </>
  );
}
