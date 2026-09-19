"use client";

import { useState } from "react";
import Link from "next/link";
import { Pencil, X, Trophy } from "lucide-react";
import { EVENT_STATUS_LABELS } from "@/lib/eventStatus";
import { ActionForm } from "./ActionForm";
import { DeleteEventButton } from "./DeleteEventButton";
import { CancelEventButton } from "./CancelEventButton";

type EventData = {
  id: string;
  date: string;
  time: string | null;
  location: string | null;
  num_teams: number;
  price_per_player: number | null;
  max_players: number | null;
  status: string;
  official_list_open: boolean;
  is_pre_torneio: boolean;
};

export function EventListItem({
  event,
  updateEvent,
  markAsPreTorneio,
  cancelEvent,
  deleteEvent,
}: {
  event: EventData;
  updateEvent: (formData: FormData) => Promise<void>;
  markAsPreTorneio: (formData: FormData) => Promise<void>;
  cancelEvent: (formData: FormData) => Promise<void>;
  deleteEvent: (formData: FormData) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const statusInfo = EVENT_STATUS_LABELS[event.status];

  return (
    <div className="rounded-lg border border-white/10">
      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        <Link href={`/racha/${event.id}`} className="w-full min-w-0 break-words font-medium text-white hover:underline sm:w-auto sm:flex-1">
          {new Date(`${event.date}T00:00:00`).toLocaleDateString("pt-BR")}
          {event.location ? ` · ${event.location}` : ""}
        </Link>
        {event.is_pre_torneio && (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-300">
            <Trophy className="h-3 w-3" strokeWidth={2} />
            Pré-torneio
          </span>
        )}
        {event.status === "open" && (
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
              event.official_list_open ? "bg-blue-500/15 text-blue-300" : "bg-amber-500/15 text-amber-300"
            }`}
          >
            {event.official_list_open ? "Lista de confirmados publicada" : "Fase de interesse"}
          </span>
        )}
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
            statusInfo?.className ?? "bg-white/10 text-white/60"
          }`}
        >
          {statusInfo?.label ?? event.status}
        </span>
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          aria-label={editing ? "Fechar edição" : "Editar racha"}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 text-white/60 hover:bg-white/5 hover:text-purple-300"
        >
          {editing ? <X className="h-4 w-4" strokeWidth={2} /> : <Pencil className="h-4 w-4" strokeWidth={2} />}
        </button>
        {!event.is_pre_torneio && event.status !== "finished" && event.status !== "cancelled" && (
          <ActionForm action={markAsPreTorneio} successMessage="Racha transformado em pré-torneio!">
            <input type="hidden" name="eventId" value={event.id} />
            <button
              type="submit"
              aria-label="Transformar em pré-torneio"
              title="Transformar em pré-torneio"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/15 text-amber-400 hover:bg-amber-500/20"
            >
              <Trophy className="h-4 w-4" strokeWidth={2} />
            </button>
          </ActionForm>
        )}
        {event.status !== "cancelled" && <CancelEventButton eventId={event.id} action={cancelEvent} />}
        <DeleteEventButton eventId={event.id} action={deleteEvent} />
      </div>

      {editing && (
        <ActionForm
          action={async (formData) => {
            await updateEvent(formData);
            setEditing(false);
          }}
          successMessage="Racha atualizado!"
          className="grid gap-4 border-t border-white/10 p-4 sm:grid-cols-2"
        >
          <input type="hidden" name="eventId" value={event.id} />
          <div>
            <label className="block text-xs font-medium text-white/60">Data</label>
            <input
              type="date"
              name="date"
              defaultValue={event.date}
              required
              className="mt-1 w-full rounded-lg border border-white/15 px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-white/60">Horário</label>
            <input
              type="time"
              name="time"
              defaultValue={event.time?.slice(0, 5) ?? ""}
              className="mt-1 w-full rounded-lg border border-white/15 px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-white/60">Local</label>
            <input
              name="location"
              defaultValue={event.location ?? ""}
              className="mt-1 w-full rounded-lg border border-white/15 px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-white/60">Número de times</label>
            <input
              type="number"
              name="numTeams"
              defaultValue={event.num_teams}
              min={2}
              required
              className="mt-1 w-full rounded-lg border border-white/15 px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-white/60">Valor por jogador (R$)</label>
            <input
              type="number"
              name="pricePerPlayer"
              step={0.5}
              min={0}
              defaultValue={event.price_per_player ?? ""}
              className="mt-1 w-full rounded-lg border border-white/15 px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-white/60">Vagas de confirmados (opcional)</label>
            <input
              type="number"
              name="maxPlayers"
              min={1}
              defaultValue={event.max_players ?? ""}
              className="mt-1 w-full rounded-lg border border-white/15 px-3 py-2"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="flex items-center gap-2 text-sm text-white">
              <input
                type="checkbox"
                name="isPreTorneio"
                defaultChecked={event.is_pre_torneio}
                className="h-4 w-4 rounded border-white/15 text-amber-400 focus:ring-amber-400"
              />
              Racha especial (pré-torneio) — fase de grupos + final, time campeão garante vaga no Torneios VPA
            </label>
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded-lg bg-brand-purple px-4 py-2 text-sm font-medium text-white hover:bg-brand-purple-dark"
            >
              Salvar alterações
            </button>
          </div>
        </ActionForm>
      )}
    </div>
  );
}
