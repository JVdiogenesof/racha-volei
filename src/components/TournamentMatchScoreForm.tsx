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
      className="grid min-w-0 gap-3 rounded-lg border border-white/10 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
    >
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="matchId" value={matchId} />
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-2">
        <label className="min-w-0 text-center text-sm font-medium text-white">
          <span className="mb-2 block break-words">{teamALabel}</span>
          <input
            type="number"
            name="scoreA"
            min={0}
            required
            defaultValue={scoreA ?? ""}
            aria-label={`Placar de ${teamALabel}`}
            inputMode="numeric"
            className="mx-auto block min-h-11 w-full max-w-24 rounded-lg border border-white/15 px-2 py-2 text-center text-base"
          />
        </label>
        <span className="pb-3 text-white/40" aria-label="contra">×</span>
        <label className="min-w-0 text-center text-sm font-medium text-white">
          <span className="mb-2 block break-words">{teamBLabel}</span>
          <input
            type="number"
            name="scoreB"
            min={0}
            required
            defaultValue={scoreB ?? ""}
            aria-label={`Placar de ${teamBLabel}`}
            inputMode="numeric"
            className="mx-auto block min-h-11 w-full max-w-24 rounded-lg border border-white/15 px-2 py-2 text-center text-base"
          />
        </label>
      </div>
      <button
        type="submit"
        className="min-h-11 rounded-lg bg-brand-purple px-3 py-2 text-sm font-medium text-white hover:bg-brand-purple-dark"
      >
        {played ? "Atualizar placar" : "Salvar placar"}
      </button>
    </ActionForm>
  );
}
