import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

// Campo de formulário compacto, inspirado no "shell" da Halo Input (Cult UI):
// moldura com cantos arredondados, leve destaque de foco e rótulo com ícone.
// Reimplementado só com Tailwind (sem Base UI / Motion, que o projeto não usa)
// e com o brilho de foco na cor roxa da marca em vez do degradê multicolor
// original, pra não fugir da identidade visual do VPA.
export type FormFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  icon?: LucideIcon;
  optional?: boolean;
  hint?: string;
  prefix?: ReactNode;
};

export const FormField = forwardRef<HTMLInputElement, FormFieldProps>(function FormField(
  { label, icon: Icon, optional, hint, prefix, className, id, ...inputProps },
  ref,
) {
  return (
    <label className="block min-w-0" htmlFor={id}>
      <span className="flex items-center gap-1.5 text-xs font-medium text-white/60">
        {Icon && <Icon className="h-3.5 w-3.5 text-purple-300" strokeWidth={2} />}
        {label}
        {optional && <span className="text-white/30">(opcional)</span>}
      </span>
      <div
        className={cn(
          "mt-1.5 flex min-h-10 w-full min-w-0 items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.03] px-3 transition",
          "focus-within:border-purple-300/50 focus-within:bg-white/[0.05] focus-within:shadow-[0_0_0_3px_rgba(196,181,253,0.14)]",
        )}
      >
        {prefix && <span className="shrink-0 text-sm text-white/40">{prefix}</span>}
        <input
          ref={ref}
          id={id}
          {...inputProps}
          className={cn(
            "min-w-0 flex-1 appearance-none border-0 bg-transparent py-2 text-sm text-white outline-none placeholder:text-white/25",
            "[&::-webkit-date-and-time-value]:text-left",
            className,
          )}
        />
      </div>
      {hint && <span className="mt-1 block text-[11px] leading-relaxed text-white/35">{hint}</span>}
    </label>
  );
});
