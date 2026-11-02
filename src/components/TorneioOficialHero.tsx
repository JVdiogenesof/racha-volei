import { Award, CalendarDays, Crown, Gauge, Shirt, Trophy, Volleyball } from "lucide-react";

/** Capa animada do Torneio oficial: mesma linguagem da Copa VPA, em dourado + roxo. */
export function TorneioOficialHero({
  eyebrow,
  whenLabel,
  whenDetail,
  guaranteedCount,
  indexSlots,
  indexOnlyCount,
}: {
  eyebrow: string;
  whenLabel: string;
  whenDetail: string;
  /** Vagas já garantidas pelo pré-torneio ou pela organização. */
  guaranteedCount: number;
  /** Vagas que vêm do Índice VPA (zona de classificação). */
  indexSlots: number;
  /** Quem está na zona do Índice sem já ter vaga garantida. */
  indexOnlyCount: number;
}) {
  const total = guaranteedCount + indexOnlyCount;

  return (
    <header className="copa-frame theme-gold rounded-[28px]">
      <div className="copa-hero theme-gold copa-shine rounded-[26px] px-5 pb-5 pt-6 sm:px-8 sm:pb-7 sm:pt-8">
        <span aria-hidden className="copa-orb -left-10 -top-12 h-44 w-44 bg-amber-400" />
        <span aria-hidden className="copa-orb copa-orb-slow -bottom-16 -right-10 h-52 w-52 bg-violet-500" />
        <span aria-hidden className="copa-orb copa-orb-fast right-1/3 top-1/4 h-28 w-28 bg-yellow-300" />
        {[
          "left-[12%] top-[18%]",
          "left-[78%] top-[12%]",
          "left-[62%] top-[46%]",
          "left-[22%] top-[72%]",
          "left-[90%] top-[64%]",
        ].map((position, index) => (
          <span key={position} aria-hidden className={`copa-twinkle absolute h-1.5 w-1.5 rounded-full bg-amber-100 ${position}`} style={{ animationDelay: `${index * 0.45}s` }} />
        ))}

        <div className="relative z-10 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.25em] text-amber-100/90">
              <Volleyball className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} />
              {eyebrow}
            </p>
            <h1 className="copa-title theme-gold mt-2 text-4xl font-black uppercase leading-[0.95] tracking-tight sm:text-6xl">
              Torneio
              <br />
              Oficial VPA
            </h1>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-white/80">
              O grande torneio do Vôlei Por Amor. A vaga vem de dois jeitos: vencendo um pré-torneio ou terminando na zona de classificação do Índice VPA.
            </p>
          </div>
          <div className="copa-float relative hidden shrink-0 sm:block" aria-hidden>
            <span className="absolute inset-0 rounded-full bg-amber-400/40 blur-2xl" />
            <span className="relative flex h-24 w-24 items-center justify-center rounded-full border border-amber-200/40 bg-white/10 backdrop-blur">
              <Trophy className="h-12 w-12 text-amber-100 drop-shadow-[0_0_12px_rgba(251,191,36,0.95)]" strokeWidth={1.6} />
            </span>
            <Volleyball className="copa-orbit absolute -right-2 -top-2 h-7 w-7 text-amber-100" strokeWidth={1.8} />
          </div>
        </div>

        <div className="relative z-10 mt-5 grid grid-cols-3 gap-2">
          <Stat icon={CalendarDays} label="Quando" value={whenLabel} detail={whenDetail} />
          <Stat icon={Award} label="Campeões" value={`${guaranteedCount}`} detail="garantidos" />
          <Stat icon={Gauge} label="Ranking" value={`${indexSlots}`} detail="vagas extras" />
        </div>

        <div className="relative z-10 mt-4 rounded-2xl border border-white/15 bg-black/20 p-3">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-white/60">Classificados hoje</p>
            <p className="text-sm font-black text-white">
              {total}
              <span className="text-white/50"> jogadores</span>
            </p>
          </div>
          <div className="mt-2.5 grid grid-cols-12 gap-1.5" aria-hidden>
            {Array.from({ length: total }, (_, index) => {
              const tone = index < guaranteedCount ? "copa-slot-on theme-gold" : "copa-slot-on theme-violet";
              return <span key={index} className={`copa-slot h-2.5 rounded-full ${tone}`} style={{ animationDelay: `${index * 0.04}s` }} />;
            })}
          </div>
          <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-semibold text-white/70">
            <span className="inline-flex items-center gap-1.5">
              <span className="copa-slot-on theme-gold h-2 w-4 rounded-full" /> Pré-torneio
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="copa-slot-on theme-violet h-2 w-4 rounded-full" /> Índice VPA (provisório)
            </span>
          </div>
        </div>

        <div className="relative z-10 mt-4 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-white">
            <Shirt className="h-3.5 w-3.5 text-amber-200" strokeWidth={2.25} />
            Uniforme oficial obrigatório
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-white">
            <Crown className="h-3.5 w-3.5 text-amber-200" strokeWidth={2.25} />
            O maior título do VPA
          </span>
        </div>
      </div>
    </header>
  );
}

function Stat({ icon: Icon, label, value, detail }: { icon: typeof Trophy; label: string; value: string; detail?: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/15 bg-white/10 px-2.5 py-2 backdrop-blur-sm sm:px-3">
      <p className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-white/60 sm:text-[10px]">
        <Icon className="h-3 w-3 shrink-0" strokeWidth={2.5} /> {label}
      </p>
      <p className="mt-0.5 break-words text-base font-black text-white sm:text-lg">{value}</p>
      {detail && <p className="break-words text-[10px] text-white/55 sm:text-[11px]">{detail}</p>}
    </div>
  );
}
