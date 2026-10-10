import { CalendarClock } from "lucide-react";
import { registrationInputParts } from "@/lib/registrationSchedule";

// No iPhone (Safari), os campos nativos de data/hora têm largura mínima
// própria e ignoram w-full, vazando pela borda do card. appearance-none
// desliga o visual nativo e faz o campo respeitar a largura do container;
// o alinhamento à esquerda do valor evita que o texto fique centralizado.
const DATE_TIME_INPUT_CLASS =
  "mt-1 block w-full min-w-0 max-w-full min-h-10 appearance-none rounded-lg border border-white/15 px-3 py-2 text-left [&::-webkit-date-and-time-value]:text-left";

export function RegistrationScheduleFields({
  defaultOpensAt,
  required = true,
}: {
  defaultOpensAt?: string | null;
  required?: boolean;
}) {
  const defaults = registrationInputParts(defaultOpensAt ?? null);

  return (
    <div className="sm:col-span-2 min-w-0 overflow-hidden rounded-xl border border-fuchsia-300/20 bg-fuchsia-400/[0.06] p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-fuchsia-400/10 text-fuchsia-200">
          <CalendarClock className="h-4.5 w-4.5" strokeWidth={2} />
        </span>
        <p className="text-sm font-semibold text-white">Abertura das inscrições</p>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-white/50">
        Até esse momento, todos verão a contagem regressiva. No horário escolhido, o botão para colocar o nome é liberado automaticamente.
      </p>
      <div className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2">
        <label className="block min-w-0 text-xs font-medium text-white/65">
          Data
          <input type="date" name="registrationOpenDate" defaultValue={defaults.date} required={required} className={DATE_TIME_INPUT_CLASS} />
        </label>
        <label className="block min-w-0 text-xs font-medium text-white/65">
          Horário
          <input type="time" name="registrationOpenTime" defaultValue={defaults.time} required={required} className={DATE_TIME_INPUT_CLASS} />
        </label>
      </div>
      <p className="mt-2 text-[11px] text-white/35">
        Horário de Fortaleza. {required ? "Escolha quando a lista será aberta." : "Se deixar os dois campos vazios, o agendamento atual será mantido."}
      </p>
    </div>
  );
}
