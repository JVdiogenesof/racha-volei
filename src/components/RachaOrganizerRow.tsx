"use client";

import { useState, type ReactNode } from "react";
import { Pencil, X } from "lucide-react";
import { RachaForm, type RachaFormDefaults } from "./RachaForm";
import { CancelEventButton } from "./CancelEventButton";
import { DeleteEventButton } from "./DeleteEventButton";

/**
 * Envolve a visualização normal de um racha (o card que todo mundo vê) com
 * os controles de organizador: editar embutido, cancelar e excluir. Fica
 * tudo na aba Rachas agora -- antes só dava pra editar na tela de Admin.
 */
export function RachaOrganizerRow({
  eventId,
  status,
  defaults,
  updateEventAction,
  cancelEventAction,
  deleteEventAction,
  children,
}: {
  eventId: string;
  status: string;
  defaults: RachaFormDefaults;
  updateEventAction: (formData: FormData) => Promise<void>;
  cancelEventAction: (formData: FormData) => Promise<void>;
  deleteEventAction: (formData: FormData) => Promise<void>;
  children: ReactNode;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="min-w-0">
      {children}
      <div className="mt-1 flex items-center justify-end gap-1.5 px-0.5">
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          aria-expanded={editing}
          aria-label={editing ? "Fechar edição" : "Editar racha"}
          className="flex h-8 shrink-0 items-center gap-1 rounded-full border border-white/10 px-2.5 text-[11px] font-semibold text-white/60 hover:bg-white/5 hover:text-purple-300"
        >
          {editing ? <X className="h-3.5 w-3.5" strokeWidth={2} /> : <Pencil className="h-3.5 w-3.5" strokeWidth={2} />}
          {editing ? "Fechar" : "Editar"}
        </button>
        {status !== "cancelled" && <CancelEventButton eventId={eventId} action={cancelEventAction} />}
        <DeleteEventButton eventId={eventId} action={deleteEventAction} />
      </div>

      {editing && (
        <div className="mt-2 min-w-0 rounded-2xl border border-white/10 bg-white/[0.035] p-3.5 sm:p-4">
          <RachaForm
            eventId={eventId}
            action={updateEventAction}
            defaults={defaults}
            submitLabel="Salvar alterações"
            successMessage="Racha atualizado!"
            registrationRequired={false}
            onSuccess={() => setEditing(false)}
          />
        </div>
      )}
    </div>
  );
}
