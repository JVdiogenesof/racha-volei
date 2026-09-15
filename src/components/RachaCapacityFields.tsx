"use client";

import { useState } from "react";
import { Trophy } from "lucide-react";

const PLAYERS_PER_TEAM = 6;
const PRE_TORNEIO_TEAMS = 4;

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
  const [isPreTorneio, setIsPreTorneio] = useState(false);

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
                setMaxPlayersTouched(false);
                setMaxPlayers(PRE_TORNEIO_TEAMS * PLAYERS_PER_TEAM);
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
          Fase de grupos (todos os times contra todos) seguida de uma final entre os 2 primeiros colocados — o time
          campeão garante vaga automática no Torneios VPA. Sugere 4 times / 24 vagas, mas dá pra ajustar.
        </p>
      </div>
    </>
  );
}
