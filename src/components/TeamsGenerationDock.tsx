"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { ActionForm } from "./ActionForm";
import { SimulateTeamsButton } from "./SimulateTeamsButton";
import { FixedTeamPicker } from "./FixedTeamPicker";
import type { SimulatedTeam } from "@/app/(app)/racha/[id]/times/actions";

type Player = { profileId: string; fullName: string; avatarUrl: string | null };

/**
 * Reúne o seletor de time fixo, a simulação e a geração oficial num só
 * lugar, porque os três precisam compartilhar a mesma escolha de quem fica
 * reservado no time 1.
 */
export function TeamsGenerationDock({
  eventId,
  confirmedPlayers,
  teamSize,
  generateAction,
  simulateAction,
  hasGeneration,
  canGenerate,
}: {
  eventId: string;
  confirmedPlayers: Player[];
  teamSize: number;
  generateAction: (formData: FormData) => Promise<void>;
  simulateAction: (eventId: string, previousSignature?: string, fixedTeamProfileIds?: string[]) => Promise<SimulatedTeam[]>;
  hasGeneration: boolean;
  /** A lista oficial pode ainda não ter sido aberta -- nesse caso só dá pra simular, não gerar de verdade. */
  canGenerate: boolean;
}) {
  const [fixedTeamIds, setFixedTeamIds] = useState<string[]>([]);

  return (
    <>
      <FixedTeamPicker players={confirmedPlayers} teamSize={teamSize} selectedIds={fixedTeamIds} onChange={setFixedTeamIds} />
      <SimulateTeamsButton eventId={eventId} action={simulateAction} fixedTeamProfileIds={fixedTeamIds} compact />
      {canGenerate && (
        <ActionForm action={generateAction} successMessage={hasGeneration ? "Times gerados novamente!" : "Times gerados com sucesso!"}>
          <input type="hidden" name="eventId" value={eventId} />
          {fixedTeamIds.map((id) => (
            <input key={id} type="hidden" name="fixedTeamProfileIds" value={id} />
          ))}
          <button type="submit" aria-label={hasGeneration ? "Gerar times novamente" : "Gerar times"} title={hasGeneration ? "Gerar times novamente" : "Gerar times"} className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-purple text-white hover:bg-brand-purple-dark">
            <RefreshCw className="h-5 w-5" />
          </button>
        </ActionForm>
      )}
    </>
  );
}
