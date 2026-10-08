import { CalendarClock } from "lucide-react";
import { registrationInputParts } from "@/lib/registrationSchedule";

export function RegistrationScheduleFields({ defaultOpensAt }: { defaultOpensAt?: string | null }) {
  const defaults = registrationInputParts(defaultOpensAt ?? null);

  return (
    <fieldset className="sm:col-span-2 rounded-xl border border-fuchsia-300/20 bg-fuchsia-400/[0.06] p-4">
      <legend className="px-1 text-sm font-semibold text-white">Abertura das inscrições</legend>
      <div className="flex items-start gap-3">
        <span className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-fuchsia-400/10 text-fuchsia-200">
          <CalendarClock className="h-4.5 w-4.5" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs leading-relaxed text-white/50">
            Até esse momento, todos verão a contagem regressiva. No horário escolhido, o botão para colocar o nome é liberado automaticamente.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block min-w-0 text-xs font-medium text-white/65">
              Data
              <input type="date" name="registrationOpenDate" defaultValue={defaults.date} required className="mt-1 block min-w-0 w-full rounded-lg border border-white/15 px-3 py-2" />
            </label>
            <label className="block min-w-0 text-xs font-medium text-white/65">
              Horário
              <input type="time" name="registrationOpenTime" defaultValue={defaults.time} required className="mt-1 block min-w-0 w-full rounded-lg border border-white/15 px-3 py-2" />
            </label>
          </div>
          <p className="mt-2 text-[11px] text-white/35">Horário de Fortaleza. Vocês podem alterar esse agendamento depois.</p>
        </div>
      </div>
    </fieldset>
  );
}
