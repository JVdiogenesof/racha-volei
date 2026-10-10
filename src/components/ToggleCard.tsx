import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

const ACCENTS = {
  emerald: {
    border: "border-emerald-300/15",
    bg: "bg-emerald-400/5",
    borderChecked: "has-[:checked]:border-emerald-300/40",
    bgChecked: "has-[:checked]:bg-emerald-400/10",
    track: "group-has-[:checked]:bg-emerald-400/70",
    icon: "text-emerald-300",
  },
  purple: {
    border: "border-purple-300/15",
    bg: "bg-purple-400/5",
    borderChecked: "has-[:checked]:border-purple-300/40",
    bgChecked: "has-[:checked]:bg-purple-400/10",
    track: "group-has-[:checked]:bg-purple-400/70",
    icon: "text-purple-300",
  },
} as const;

// Toggle em formato de switch dentro de um cartão com título e descrição.
// Inspirado no padrão visual da Halo Switch (Cult UI), mas em CSS puro — sem
// Motion — usando `has()`/`group-has()` do Tailwind pra animar a bolinha,
// então continua leve e sem depender de bibliotecas novas.
export function ToggleCard({
  name,
  title,
  description,
  icon: Icon,
  defaultChecked,
  accent = "emerald",
}: {
  name: string;
  title: string;
  description: string;
  icon?: LucideIcon;
  defaultChecked?: boolean;
  accent?: keyof typeof ACCENTS;
}) {
  const a = ACCENTS[accent];
  return (
    <label
      className={cn(
        "group flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition active:scale-[0.99] sm:col-span-2",
        a.border,
        a.bg,
        a.borderChecked,
        a.bgChecked,
      )}
    >
      <input type="checkbox" name={name} value="true" defaultChecked={defaultChecked} className="sr-only" />
      <span
        className={cn("relative mt-0.5 h-5 w-9 shrink-0 rounded-full bg-white/15 transition-colors duration-200", a.track)}
        aria-hidden="true"
      >
        <span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 group-has-[:checked]:translate-x-4" />
      </span>
      <span>
        <span className="flex items-center gap-1.5 text-sm font-semibold text-white">
          {Icon && <Icon className={cn("h-4 w-4", a.icon)} strokeWidth={2} />}
          {title}
        </span>
        <span className="mt-0.5 block text-xs leading-relaxed text-white/50">{description}</span>
      </span>
    </label>
  );
}
