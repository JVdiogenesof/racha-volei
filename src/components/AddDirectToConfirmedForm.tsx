"use client";

import { UserPlus } from "lucide-react";
import { ActionForm } from "./ActionForm";

export function AddDirectToConfirmedForm({
  action,
  eventId,
  players,
}: {
  action: (formData: FormData) => void;
  eventId: string;
  players: { id: string; fullName: string }[];
}) {
  if (!players.length) return null;

  return (
    <ActionForm
      action={action}
      successMessage="Jogador adicionado aos confirmados!"
      className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-white/15 px-4 py-3"
    >
      <input type="hidden" name="eventId" value={eventId} />
      <UserPlus className="h-4 w-4 shrink-0 text-white/40" strokeWidth={2} />
      <span className="text-sm text-white/60">Alguém pagou mas não marcou interesse?</span>
      <select
        name="profileId"
        defaultValue=""
        required
        className="rounded-lg border border-white/15 px-2 py-1.5 text-sm"
      >
        <option value="" disabled>
          Escolher jogador...
        </option>
        {players.map((p) => (
          <option key={p.id} value={p.id}>
            {p.fullName}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className="ml-auto rounded-lg bg-brand-navy px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-navy-light"
      >
        Adicionar aos confirmados
      </button>
    </ActionForm>
  );
}
