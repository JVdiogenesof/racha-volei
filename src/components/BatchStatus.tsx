import { Layers } from "lucide-react";
import { batchPhase } from "@/lib/registrationSchedule";

type Props = {
  maxPlayers: number | null;
  firstBatchSpots: number | null;
  secondBatchOpensAt: string | null;
  confirmedCount: number;
  compact?: boolean;
};

function whenLabel(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Fortaleza",
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Deixa claro em qual lote a lista está: Lote 1 aberto, Lote 1 esgotado ou
 * Lote 2 aberto. Não renderiza nada em rachas sem lotes.
 */
export function BatchStatus({ maxPlayers, firstBatchSpots, secondBatchOpensAt, confirmedCount, compact = false }: Props) {
  if (maxPlayers == null || firstBatchSpots == null || !secondBatchOpensAt) return null;

  const firstSpots = Math.min(firstBatchSpots, maxPlayers);
  const secondSpots = Math.max(0, maxPlayers - firstSpots);
  const phase = batchPhase(secondBatchOpensAt, firstSpots, confirmedCount);
  const secondOpen = phase === "second_open";
  const firstFull = phase === "first_full";

  const tone = secondOpen
    ? { box: "border-emerald-300/25 bg-emerald-400/10", icon: "text-emerald-300", chip: "bg-emerald-400/20 text-emerald-200", text: "text-emerald-100" }
    : firstFull
      ? { box: "border-amber-300/25 bg-amber-400/10", icon: "text-amber-300", chip: "bg-amber-400/20 text-amber-200", text: "text-amber-100" }
      : { box: "border-sky-300/25 bg-sky-400/10", icon: "text-sky-300", chip: "bg-sky-400/20 text-sky-200", text: "text-sky-100" };

  const label = secondOpen ? "Lote 2 aberto" : firstFull ? "Lote 1 esgotado" : "Lote 1 aberto";
  const detail = secondOpen
    ? "Todas as vagas restantes estão liberadas."
    : firstFull
      ? `Lote 2 (${secondSpots} ${secondSpots === 1 ? "vaga" : "vagas"}) abre ${whenLabel(secondBatchOpensAt)}.`
      : `${firstSpots} vagas neste lote. Lote 2 (${secondSpots} ${secondSpots === 1 ? "vaga" : "vagas"}) abre ${whenLabel(secondBatchOpensAt)}.`;

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
