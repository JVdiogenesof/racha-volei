import { Layers } from "lucide-react";
import { registrationInputParts } from "@/lib/registrationSchedule";

// Mesmo tratamento dos campos de abertura das inscrições (Safari iOS).
const INPUT_CLASS =
  "mt-1 block w-full min-w-0 max-w-full min-h-10 appearance-none rounded-lg border border-white/15 px-3 py-2 text-left [&::-webkit-date-and-time-value]:text-left";

/**
 * Lotes de vagas: a lista abre no horário normal só com as vagas do Lote 1 e
 * o restante abre depois. Os três campos em branco = racha sem lotes.
 */
export function SpotBatchFields({
  defaultFirstBatchSpots,
  defaultSecondBatchOpensAt,
}: {
  defaultFirstBatchSpots: number | null;
  defaultSecondBatchOpensAt: string | null;
}) {
  const second = registrationInputParts(defaultSecondBatchOpensAt);

  return (
    <div className="sm:col-span-2 min-w-0 overflow-hidden rounded-xl border border-sky-300/20 bg-sky-400/[0.06] p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-400/10 text-sky-200">
          <Layers className="h-4.5 w-4.5" strokeWidth={2} />
        </span>
        <p className="text-sm font-semibold text-white">Lotes de vagas <span className="text-xs font-normal text-white/40">(opcional)</span></p>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-white/50">
        As inscrições abrem no horário acima com apenas as vagas do Lote 1. No horário do Lote 2, as vagas restantes (incluindo sobras do Lote 1) são liberadas automaticamente. Organizadores e isentos não são limitados pelo Lote 1. Deixe em branco para abrir todas as vagas de uma vez.
      </p>
      <div className="mt-3 grid min-w-0 gap-3 sm:grid-cols-3">
        <label className="block min-w-0 text-xs font-medium text-white/65">
          Vagas no Lote 1
          <input type="number" name="firstBatchSpots" min={1} inputMode="numeric" defaultValue={defaultFirstBatchSpots ?? ""} className={INPUT_CLASS} />
        </label>
        <label className="block min-w-0 text-xs font-medium text-white/65">
          Lote 2 · data
          <input type="date" name="secondBatchDate" defaultValue={second.date} className={INPUT_CLASS} />
        </label>
        <label className="block min-w-0 text-xs font-medium text-white/65">
          Lote 2 · horário
          <input type="time" name="secondBatchTime" defaultValue={second.time} className={INPUT_CLASS} />
        </label>
      </div>
      <p className="mt-2 text-[11px] text-white/35">Horário de Fortaleza.</p>
    </div>
  );
}
