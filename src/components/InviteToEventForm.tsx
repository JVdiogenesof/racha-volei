"use client";

import Link from "next/link";
import { Send } from "lucide-react";
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
    return <p className="text-xs text-amber-200/75">Crie o próximo racha antes de chamar. <Link href="/admin/rachas" className="font-bold underline hover:text-amber-100">Criar racha</Link></p>;
  }

  return (
    <ActionForm action={action} successMessage="Pessoa chamada! Ela já tem acesso a esse racha." className="flex min-w-0 flex-1 items-center gap-1.5">
      <input type="hidden" name="reserveEntryId" value={reserveEntryId} />
      <select
        name="eventId"
        defaultValue=""
        required
        className="min-h-10 min-w-0 flex-1 rounded-lg border border-white/15 bg-[#1c1233] px-2 py-1.5 text-xs text-white sm:max-w-52"
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
        aria-label="Chamar para o racha selecionado"
        title="Chamar para o racha selecionado"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-purple text-white hover:bg-brand-purple-dark"
      >
        <Send className="h-4 w-4" />
      </button>
    </ActionForm>
  );
}
