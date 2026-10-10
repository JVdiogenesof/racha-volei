import { forwardRef, type ReactNode, type SelectHTMLAttributes } from "react";
import type { LucideIcon } from "lucide-react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

// Mesmo "shell" do FormField, mas pra <select> — pra manter os dois com a
// cara igual (moldura arredondada, ícone no rótulo, brilho roxo no foco).
export type FormSelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  icon?: LucideIcon;
  optional?: boolean;
  children: ReactNode;
};

export const FormSelect = forwardRef<HTMLSelectElement, FormSelectProps>(function FormSelect(
  { label, icon: Icon, optional, className, id, children, ...selectProps },
  ref,
) {
  return (
    <label className="block min-w-0" htmlFor={id}>
      {label && (
        <span className="flex items-center gap-1.5 text-xs font-medium text-white/60">
          {Icon && <Icon className="h-3.5 w-3.5 text-purple-300" strokeWidth={2} />}
          {label}
          {optional && <span className="text-white/30">(opcional)</span>}
        </span>
      )}
      <div
        className={cn(
          "relative mt-1.5 flex min-h-10 w-full min-w-0 items-center rounded-xl border border-white/15 bg-white/[0.03] transition",
          "focus-within:border-purple-300/50 focus-within:bg-white/[0.05] focus-within:shadow-[0_0_0_3px_rgba(196,181,253,0.14)]",
          !label && "mt-0",
        )}
      >
        <select
          ref={ref}
          id={id}
          {...selectProps}
          className={cn(
            "min-w-0 flex-1 appearance-none border-0 bg-transparent py-2 pl-3 pr-8 text-sm text-white outline-none",
            className,
          )}
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 h-4 w-4 text-white/35" strokeWidth={2} />
      </div>
    </label>
  );
});
