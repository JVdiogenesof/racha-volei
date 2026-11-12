import { Layers } from "lucide-react";
import { batchPhase, formatBatchOpening, lote1SetterHold, lote1SetterLimit } from "@/lib/registrationSchedule";

type Props = {
  maxPlayers: number | null;
  firstBatchSpots: number | null;
  secondBatchOpensAt: string | null;
  /** Abertura das inscrições: antes dela o Lote 1 ainda não abriu. */
  registrationOpensAt?: string | null;
  confirmedCount: number;
  /** Levantadores já confirmados: o Lote 1 guarda vagas para eles. */
  setterCount?: number;
  compact?: boolean;
};


/**
 * Deixa claro em qual lote a lista está: Lote 1 aberto, Lote 1 esgotado ou
 * Lote 2 aberto. Não renderiza nada em rachas sem lotes.
 */
export function BatchStatus({ maxPlayers, firstBatchSpots, secondBatchOpensAt, registrationOpensAt = null, confirmedCount, setterCount = 0, compact = false }: Props) {
  if (maxPlayers == null || firstBatchSpots == null || !secondBatchOpensAt) return null;

  const firstSpots = Math.min(firstBatchSpots, maxPlayers);
  const secondSpots = Math.max(0, maxPlayers - firstSpots);
  const hold = lote1SetterHold(maxPlayers, setterCount);
  const setterLimit = lote1SetterLimit(maxPlayers);
  const phase = batchPhase(secondBatchOpensAt, firstSpots, confirmedCount, undefined, registrationOpensAt, hold);
  const notOpen = phase === "not_open";
  const secondOpen = phase === "second_open";
  // Lote 2 aberto e lista completa: vira uma lista só, sem falar mais em lotes.
  if (secondOpen && confirmedCount >= maxPlayers) return null;
  const firstFull = phase === "first_full";

  const tone = notOpen
    ? { box: "border-white/15 bg-white/[0.05]", icon: "text-white/60", chip: "bg-white/15 text-white/80", text: "text-white/75" }
    : secondOpen
    ? { box: "border-emerald-300/25 bg-emerald-400/10", icon: "text-emerald-300", chip: "bg-emerald-400/20 text-emerald-200", text: "text-emerald-100" }
    : firstFull
      ? { box: "border-amber-300/25 bg-amber-400/10", icon: "text-amber-300", chip: "bg-amber-400/20 text-amber-200", text: "text-amber-100" }
      : { box: "border-sky-300/25 bg-sky-400/10", icon: "text-sky-300", chip: "bg-sky-400/20 text-sky-200", text: "text-sky-100" };

  const label = notOpen ? "Lote 1 em breve" : secondOpen ? "Lote 2 aberto" : firstFull ? (hold > 0 ? "Lote 1 · só levantadores" : "Lote 1 esgotado") : "Lote 1 aberto";
  const lote2 = `Lote 2 (${secondSpots} ${secondSpots === 1 ? "vaga" : "vagas"}) abre ${formatBatchOpening(secondBatchOpensAt)}.`;
  const setterNote = hold > 0
    ? ` Ainda ${hold === 1 ? "resta 1 vaga" : `restam ${hold} vagas`} de levantador neste lote.`
    : ` As ${setterLimit} vagas de levantador deste lote já foram preenchidas.`;
  const detail = notOpen && registrationOpensAt
    ? `Lote 1 (${firstSpots} vagas, ${setterLimit} delas para levantadores) abre ${formatBatchOpening(registrationOpensAt)}. ${lote2}`
    : secondOpen
      ? "Todas as vagas restantes estão liberadas. Quando completar, a lista vira uma só."
      : firstFull
        ? `${lote2}${setterNote}`
        : `${firstSpots} vagas neste lote, ${setterLimit} guardadas para levantadores (${Math.min(setterCount, setterLimit)}/${setterLimit} preenchidas). ${lote2}`;

  return (
    <div className={`flex items-start gap-2 rounded-xl border ${tone.box} ${compact ? "px-2.5 py-2" : "px-3.5 py-3"}`}>
      <Layers className={`mt-0.5 h-4 w-4 shrink-0 ${tone.icon}`} strokeWidth={2.25} />
      <div className={`min-w-0 ${compact ? "text-xs" : "text-sm"} leading-relaxed ${tone.text}`}>
        <span className={`mr-1.5 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${tone.chip}`}>{label}</span>
        {detail}
      </div>
    </div>
  );
}
