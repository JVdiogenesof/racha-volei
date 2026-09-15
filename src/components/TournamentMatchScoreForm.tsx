"use client";

import { ActionForm } from "./ActionForm";

export function TournamentMatchScoreForm({
  action,
  eventId,
  matchId,
  teamALabel,
  teamBLabel,
  scoreA,
  scoreB,
}: {
  action: (formData: FormData) => Promise<void>;
  eventId: string;
  matchId: string;
  teamALabel: string;
  teamBLabel: string;
  scoreA: number | null;
  scoreB: number | null;
}) {
  const played = scoreA != null && scoreB != null;

  return (
    <ActionForm
      action={action}
      successMessage={played ? "Placar atualizado!" : "Placar salvo!"}
      className="flex flex-wrap items-center gap-2 rounded-lg border border-white/10 px-3 py-2.5"
    >
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="matchId" value={matchId} />
      <span className="min-w-0 flex-1 truncate text-sm text-white">
        {teamALabel} <span className="text-white/40">×</span> {teamBLabel}
      </span>
      <input
        type="number"
        name="scoreA"
        min={0}
        required
        defaultValue={scoreA ?? ""}
        aria-label={`Placar de ${teamALabel}`}
        className="w-16 rounded-lg border border-white/15 px-2 py-1.5 text-center text-sm"
      />
      <span className="text-white/40">x</span>
      <input
        type="number"
        name="scoreB"
        min={0}
        required
        defaultValue={scoreB ?? ""}
        aria-label={`Placar de ${teamBLabel}`}
        className="w-16 rounded-lg border border-white/15 px-2 py-1.5 text-center text-sm"
      />
      <button
        type="submit"
        className="rounded-lg bg-brand-purple px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-purple-dark"
      >
        {played ? "Atualizar placar" : "Salvar placar"}
      </button>
    </ActionForm>
  );
}
