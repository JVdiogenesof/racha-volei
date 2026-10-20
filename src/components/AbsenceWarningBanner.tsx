import Link from "next/link";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { ATTENDANCE_REMOVE_THRESHOLD } from "@/lib/attendancePolicy";

/**
 * Aviso fixo no topo da tela de início pra quem está perto de ser removido
 * pelo Regulamento de Permanência. A última falta antes do limite fica em
 * vermelho, pra não passar batido como "mais um card roxo" no meio da tela.
 */
export function AbsenceWarningBanner({ streak }: { streak: number }) {
  const remaining = ATTENDANCE_REMOVE_THRESHOLD - streak;
  if (remaining <= 0 || streak <= 0) return null;

  const critical = remaining === 1;
  const tone = critical
    ? { border: "border-red-400/40", bg: "from-red-500/20 via-red-500/8", icon: "bg-red-500/25 text-red-200", chip: "bg-red-500/25 text-red-100" }
    : { border: "border-amber-300/35", bg: "from-amber-400/18 via-amber-400/6", icon: "bg-amber-400/25 text-amber-200", chip: "bg-amber-400/25 text-amber-100" };

  return (
    <section className={`overflow-hidden rounded-2xl border ${tone.border} bg-gradient-to-br ${tone.bg} to-transparent p-4`}>
      <div className="flex items-start gap-2.5">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tone.icon}`}>
          <AlertTriangle className="h-[18px] w-[18px]" strokeWidth={2.25} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-white">
            {critical ? "Falta 1 racha pra você sair do grupo" : `Faltam ${remaining} rachas pra você sair do grupo`}
          </h3>
          <p className="mt-0.5 text-xs leading-relaxed text-white/70">
            Já são <strong className="font-bold text-white">{streak} rachas seguidos</strong> sem participar. Na {ATTENDANCE_REMOVE_THRESHOLD}ª falta
            seguida o acesso é removido automaticamente, junto com sua pontuação no Índice e vaga de torneio.
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-sm font-black tabular-nums ${tone.chip}`}>
          {streak}/{ATTENDANCE_REMOVE_THRESHOLD}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href="/racha"
          className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-purple px-3 text-sm font-bold text-white transition hover:bg-brand-purple-dark"
        >
          Garantir vaga
          <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
        </Link>
        <Link
          href="/regulamento"
          className="inline-flex min-h-10 items-center justify-center rounded-xl border border-white/15 bg-white/5 px-3 text-sm font-semibold text-white/75 transition hover:bg-white/10"
        >
          Ver regra
        </Link>
      </div>
    </section>
  );
}
