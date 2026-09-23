import { Heart, ClipboardCheck, Users, Play, Trophy, Check, type LucideIcon } from "lucide-react";

const STEPS: { label: string; icon: LucideIcon }[] = [
  { label: "Interesse", icon: Heart },
  { label: "Confirmados", icon: ClipboardCheck },
  { label: "Times", icon: Users },
  { label: "Jogos", icon: Play },
  { label: "Final", icon: Trophy },
];

export function EventProgress({
  status,
  officialListOpen,
  hasFinalResult,
}: {
  status: string;
  officialListOpen: boolean;
  hasFinalResult: boolean;
}) {
  const currentStep =
    status === "finished" || hasFinalResult
      ? 4
      : status === "in_progress"
        ? 3
        : status === "teams_generated"
          ? 2
          : officialListOpen
            ? 1
            : 0;

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 px-3 py-4 sm:px-5" aria-label="Progresso do racha">
      <div className="relative">
        <div className="absolute left-[10%] right-[10%] top-4 h-0.5 bg-white/10" aria-hidden="true">
          <span
            className="block h-full bg-gradient-to-r from-brand-purple to-purple-300 transition-[width] duration-500"
            style={{ width: `${(currentStep / (STEPS.length - 1)) * 100}%` }}
          />
        </div>
        <ol className="relative grid grid-cols-5 gap-1">
          {STEPS.map((step, index) => {
            const complete = index < currentStep;
            const active = index === currentStep;
            const Icon = complete ? Check : step.icon;
            return (
              <li key={step.label} className="flex min-w-0 flex-col items-center text-center">
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full border transition-colors ${
                    complete
                      ? "border-brand-purple bg-brand-purple text-white"
                      : active
                        ? "border-purple-300 bg-[#37206f] text-purple-100 ring-4 ring-purple-400/15"
                        : "border-white/15 bg-[#171038] text-white/35"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" strokeWidth={2.5} />
                </span>
                <span className={`mt-2 text-[9px] font-medium leading-tight sm:text-xs ${index <= currentStep ? "text-white/85" : "text-white/35"}`}>
                  {step.label}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
