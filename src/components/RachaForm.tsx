"use client";

import { Calendar, Clock, MapPin, QrCode, Wallet } from "lucide-react";
import { ActionForm } from "./ActionForm";
import { FormField } from "./FormField";
import { ToggleCard } from "./ToggleCard";
import { RegistrationScheduleFields } from "./RegistrationScheduleFields";
import { RachaCapacityFields } from "./RachaCapacityFields";

export type RachaFormDefaults = {
  date: string;
  time: string;
  location: string;
  pixPaymentEnabled: boolean;
  registrationOpensAt: string | null;
  numTeams: number;
  maxPlayers: number | null;
  teamSize: number;
  newcomerReservedSpots: number;
  isPreTorneio: boolean;
  isMiniTorneio: boolean;
  pricePerPlayer: number | null;
};

/**
 * Formulário único de racha, usado tanto pra criar quanto pra editar --
 * antes os dois formulários viviam duplicados (admin/rachas/page.tsx e
 * EventListItem.tsx), campo por campo.
 */
export function RachaForm({
  eventId,
  action,
  defaults,
  submitLabel,
  registrationRequired = true,
  hint,
  onSuccess,
  successMessage,
}: {
  eventId?: string;
  action: (formData: FormData) => Promise<void>;
  defaults: RachaFormDefaults;
  submitLabel: string;
  registrationRequired?: boolean;
  hint?: string;
  onSuccess?: () => void;
  successMessage: string;
}) {
  return (
    <ActionForm action={action} successMessage={successMessage} onSuccess={onSuccess} className="grid min-w-0 gap-3.5 sm:grid-cols-2">
      {eventId && <input type="hidden" name="eventId" value={eventId} />}
      {hint && <p className="sm:col-span-2 text-xs leading-relaxed text-white/50">{hint}</p>}

      <FormField label="Data" icon={Calendar} type="date" name="date" defaultValue={defaults.date} required />
      <FormField label="Horário" icon={Clock} optional type="time" name="time" defaultValue={defaults.time} />
      <div className="sm:col-span-2 min-w-0">
        <FormField label="Local" icon={MapPin} optional name="location" defaultValue={defaults.location} />
      </div>

      <RachaCapacityFields
        defaultNumTeams={defaults.numTeams}
        defaultMaxPlayers={defaults.maxPlayers}
        defaultTeamSize={defaults.teamSize}
        defaultNewcomerReservedSpots={defaults.newcomerReservedSpots}
        defaultIsPreTorneio={defaults.isPreTorneio}
        defaultIsMiniTorneio={defaults.isMiniTorneio}
      />

      <RegistrationScheduleFields defaultOpensAt={defaults.registrationOpensAt} required={registrationRequired} />

      <ToggleCard
        name="pixPaymentEnabled"
        icon={QrCode}
        title="Pix automático"
        description="Reserva de 5 minutos e confirmação automática após o pagamento. Exige o valor por jogador."
        defaultChecked={defaults.pixPaymentEnabled}
      />

      <FormField
        label="Valor por jogador"
        icon={Wallet}
        optional
        type="number"
        name="pricePerPlayer"
        step={0.5}
        min={0}
        prefix="R$"
        defaultValue={defaults.pricePerPlayer ?? ""}
      />

      <div className="sm:col-span-2">
        <button
          type="submit"
          className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-brand-purple px-4 text-sm font-bold text-white transition hover:bg-brand-purple-dark sm:w-auto"
        >
          {submitLabel}
        </button>
      </div>
    </ActionForm>
  );
}
