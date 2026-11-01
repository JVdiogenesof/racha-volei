import { CalendarDays, Clock3, Shirt, Sparkles, Trophy, Users, Volleyball } from "lucide-react";

/** Capa animada da Copa VPA: degradê roxo/rosa vivo, borda girando e as vagas acendendo. */
export function CopaHero({
  name,
  eyebrow,
  finalDateShort,
  finalWeekday,
  remaining,
  qualifierCount,
  numTeams,
  teamSize,
  capacity,
  qualifiedCount,
}: {
  name: string;
  eyebrow: string;
  /** null enquanto a data da final não foi decidida. */
  finalDateShort: string | null;
  finalWeekday: string | null;
  remaining: number | null;
  qualifierCount: number;
  numTeams: number;
  teamSize: number;
  capacity: number;
  qualifiedCount: number;
}) {
  const countdown =
    remaining === null ? null : remaining > 0 ? `${remaining} dia${remaining === 1 ? "" : "s"}` : remaining === 0 ? "É hoje!" : "Encerrada";

  return (
    <header className="copa-frame rounded-[28px]">
      <div className="copa-hero copa-shine rounded-[26px] px-5 pb-5 pt-6 sm:px-8 sm:pb-7 sm:pt-8">
        <span aria-hidden className="copa-orb -left-10 -top-12 h-44 w-44 bg-pink-400" />
        <span aria-hidden className="copa-orb copa-orb-slow -bottom-16 -right-10 h-52 w-52 bg-violet-500" />
        <span aria-hidden className="copa-orb copa-orb-fast right-1/3 top-1/4 h-28 w-28 bg-fuchsia-400" />
        {[
          "left-[12%] top-[18%]",
          "left-[78%] top-[12%]",
          "left-[62%] top-[46%]",
          "left-[22%] top-[72%]",
          "left-[90%] top-[64%]",
        ].map((position, index) => (
          <span key={position} aria-hidden className={`copa-twinkle absolute h-1.5 w-1.5 rounded-full bg-white ${position}`} style={{ animationDelay: `${index * 0.45}s` }} />
        ))}

        <div className="relative z-10 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.25em] text-pink-100/90">
              <Sparkles className="h-3.5 w-3.5" strokeWidth={2.25} />
              {eyebrow}
            </p>
            <h1 className="copa-title mt-2 text-4xl font-black uppercase leading-none tracking-tight sm:text-6xl">{name}</h1>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-white/80">
              Só entra quem vence. Os {capacity} campeões das classificatórias disputam a final em {numTeams} times, valendo troféu.
            </p>
          </div>
          <div className="copa-float relative hidden shrink-0 sm:block" aria-hidden>
            <span className="absolute inset-0 rounded-full bg-pink-400/40 blur-2xl" />
            <span className="relative flex h-24 w-24 items-center justify-center rounded-full border border-white/25 bg-white/10 backdrop-blur">
              <Trophy className="h-12 w-12 text-white drop-shadow-[0_0_12px_rgba(244,114,182,0.9)]" strokeWidth={1.6} />
            </span>
            <Volleyball className="copa-orbit absolute -right-2 -top-2 h-7 w-7 text-pink-100" strokeWidth={1.8} />
          </div>
        </div>

        <div className="relative z-10 mt-5 grid grid-cols-3 gap-2">
          <Stat icon={CalendarDays} label="Final" value={finalDateShort ?? "A definir"} detail={finalWeekday ?? "data em breve"} />
          {countdown ? (
            <Stat icon={Clock3} label={remaining !== null && remaining > 0 ? "Faltam" : "Status"} value={countdown} />
          ) : (
            <Stat icon={Clock3} label="Classificatórias" value={`${qualifierCount} rachas`} detail="aos domingos" />
          )}
          <Stat icon={Users} label="Formato" value={`${numTeams} times`} detail={`${teamSize} por time`} />
        </div>

        <div className="relative z-10 mt-4 rounded-2xl border border-white/15 bg-black/20 p-3">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-white/60">Vagas na final</p>
            <p className="text-sm font-black text-white">
              {qualifiedCount}
              <span className="text-white/50">/{capacity} classificados</span>
            </p>
          </div>
          <div className="mt-2.5 grid grid-cols-12 gap-1.5" aria-hidden>
            {Array.from({ length: capacity }, (_, index) => (
              <span
                key={index}
                className={`copa-slot h-2.5 rounded-full ${index < qualifiedCount ? "copa-slot-on" : "bg-white/12"}`}
                style={{ animationDelay: `${index * 0.06}s` }}
              />
            ))}
          </div>
        </div>

        <div className="relative z-10 mt-4 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-white">
            <Shirt className="h-3.5 w-3.5 text-pink-200" strokeWidth={2.25} />
            Estreia oficial do uniforme
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-white">
            <Trophy className="h-3.5 w-3.5 text-pink-200" strokeWidth={2.25} />
            Troféu para os campeões
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
      <p className="mt-0.5 truncate text-base font-black text-white sm:text-lg">{value}</p>
      {detail && <p className="truncate text-[10px] text-white/55 sm:text-[11px]">{detail}</p>}
    </div>
  );
}
