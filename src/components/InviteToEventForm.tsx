"use client";

import { ActionForm } from "./ActionForm";

export function InviteToEventForm({
  action,
  reserveEntryId,
  events,
}: {
  action: (formData: FormData) => void;
  reserveEntryId: string;
  events: { id: string; label: string }[];
}) {
  if (!events.length) {
    return <p className="text-xs text-white/40">Nenhum racha aberto pra chamar gente agora.</p>;
  }

  return (
    <ActionForm action={action} successMessage="Pessoa chamada! Ela já tem acesso a esse racha." className="flex items-center gap-2">
      <input type="hidden" name="reserveEntryId" value={reserveEntryId} />
      <select
        name="eventId"
        defaultValue=""
        required
        className="rounded-lg border border-white/15 px-2 py-1.5 text-xs"
      >
        <option value="" disabled>
          Chamar pra...
        </option>
        {events.map((e) => (
          <option key={e.id} value={e.id}>
            {e.label}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className="rounded-lg bg-brand-purple px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-purple-dark"
      >
        Chamar
      </button>
    </ActionForm>
  );
}
