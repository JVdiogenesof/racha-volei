"use client";

import { UserPlus } from "lucide-react";
import { ActionForm } from "./ActionForm";

export function QuickInviteReserveForm({
  action,
  eventId,
  people,
}: {
  action: (formData: FormData) => void;
  eventId: string;
  people: { id: string; fullName: string }[];
}) {
  if (!people.length) return null;

  return (
    <ActionForm
      action={action}
      successMessage="Pessoa chamada! Ela já tem acesso a esse racha como convidada."
      className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-white/15 px-4 py-3"
    >
      <input type="hidden" name="eventId" value={eventId} />
      <UserPlus className="h-4 w-4 shrink-0 text-white/40" strokeWidth={2} />
      <span className="text-sm text-white/60">Chamar alguém da lista de reserva</span>
      <select
        name="reserveEntryId"
        defaultValue=""
        required
        className="rounded-lg border border-white/15 px-2 py-1.5 text-sm"
      >
        <option value="" disabled>
          Escolher jogador...
        </option>
        {people.map((p) => (
          <option key={p.id} value={p.id}>
            {p.fullName}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className="ml-auto rounded-lg bg-brand-navy px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-navy-light"
      >
        Chamar
      </button>
    </ActionForm>
  );
}
