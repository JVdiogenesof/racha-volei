"use client";

import { useState } from "react";
import Link from "next/link";
import { Medal, Pencil, X, Trophy } from "lucide-react";
import { EVENT_STATUS_LABELS } from "@/lib/eventStatus";
import { ActionForm } from "./ActionForm";
import { DeleteEventButton } from "./DeleteEventButton";
import { CancelEventButton } from "./CancelEventButton";
import { RachaCapacityFields } from "./RachaCapacityFields";
import { teamFormatLabel } from "@/lib/rachaFormat";
import { RegistrationScheduleFields } from "./RegistrationScheduleFields";
import { registrationInputParts } from "@/lib/registrationSchedule";

type EventData = {
  id: string;
  date: string;
  time: string | null;
  location: string | null;
  num_teams: number;
  team_size: number;
  price_per_player: number | null;
  pix_payment_enabled: boolean;
  max_players: number | null;
  newcomer_reserved_spots: number;
  status: string;
  official_list_open: boolean;
  is_pre_torneio: boolean;
  is_mini_torneio: boolean;
  registration_opens_at: string | null;
};

export function EventListItem({
  event,
  updateEvent,
  cancelEvent,
  deleteEvent,
}: {
  event: EventData;
  updateEvent: (formData: FormData) => Promise<void>;
  cancelEvent: (formData: FormData) => Promise<void>;
  deleteEvent: (formData: FormData) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const statusInfo = EVENT_STATUS_LABELS[event.status];
  const registrationSchedule = registrationInputParts(event.registration_opens_at);

  return (
    <div className="rounded-lg border border-white/10">
      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        <Link href={`/racha/${event.id}`} className="w-full min-w-0 break-words font-medium text-white hover:underline sm:w-auto sm:flex-1">
          {new Date(`${event.date}T00:00:00`).toLocaleDateString("pt-BR")}
          {event.location ? ` · ${event.location}` : ""}
        </Link>
        <span className="shrink-0 rounded-full bg-purple-500/15 px-2.5 py-1 text-xs font-medium text-purple-200">
          {teamFormatLabel(event.team_size)}
        </span>
        {event.is_pre_torneio && (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-300">
            <Trophy className="h-3 w-3" strokeWidth={2} />
            Pré-torneio
          </span>
        )}
        {event.is_mini_torneio && (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-cyan-500/15 px-2.5 py-1 text-xs font-medium text-cyan-200">
            <Medal className="h-3 w-3" strokeWidth={2} />
            Mini torneio
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
        {event.registration_opens_at && (
          <span className="shrink-0 rounded-full border border-fuchsia-300/20 bg-fuchsia-400/10 px-2.5 py-1 text-xs font-medium text-fuchsia-100">
            Abre {new Date(event.registration_opens_at).toLocaleDateString("pt-BR", { timeZone: "America/Fortaleza", day: "2-digit", month: "2-digit" })} às {registrationSchedule.time}
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
        {event.status !== "cancelled" && <CancelEventButton eventId={event.id} action={cancelEvent} />}
        <DeleteEventButton eventId={event.id} action={deleteEvent} />
      </div>

      {editing && (
        <ActionForm
          action={updateEvent}
          successMessage="Racha atualizado!"
          onSuccess={() => setEditing(false)}
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
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-emerald-300/15 bg-emerald-400/5 p-3 sm:col-span-2">
            <input type="checkbox" name="pixPaymentEnabled" value="true" defaultChecked={event.pix_payment_enabled} className="mt-0.5 h-4 w-4" />
            <span>
              <span className="block text-sm font-semibold text-white">Pix automático</span>
              <span className="mt-0.5 block text-xs text-white/50">Reserva de 5 minutos e confirmação automática após o pagamento.</span>
            </span>
          </label>
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
          <RegistrationScheduleFields defaultOpensAt={event.registration_opens_at} required={false} />
          <RachaCapacityFields
            defaultNumTeams={event.num_teams}
            defaultMaxPlayers={event.max_players}
            defaultTeamSize={event.team_size}
            defaultNewcomerReservedSpots={event.newcomer_reserved_spots}
            defaultIsPreTorneio={event.is_pre_torneio}
            defaultIsMiniTorneio={event.is_mini_torneio}
          />
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
