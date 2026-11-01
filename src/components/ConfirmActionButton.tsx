"use client";

import { useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useToast } from "./Toast";

/** Botão que pede confirmação, chama uma Server Action e mostra o resultado num toast. */
export function ConfirmActionButton({
  action,
  fields,
  confirmMessage,
  successMessage,
  children,
  className,
  ariaLabel,
}: {
  action: (formData: FormData) => Promise<void | string> | void | string;
  fields: Record<string, string>;
  confirmMessage?: string;
  successMessage: string;
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { showToast } = useToast();

  return (
    <button
      type="button"
      disabled={isPending}
      aria-label={ariaLabel}
      onClick={() => {
        if (confirmMessage && !window.confirm(confirmMessage)) return;
        const formData = new FormData();
        for (const [key, value] of Object.entries(fields)) formData.set(key, value);
        startTransition(async () => {
          try {
            const result = await action(formData);
            showToast(result || successMessage);
            router.refresh();
          } catch (error) {
            showToast(error instanceof Error ? error.message : "Não foi possível concluir a ação.");
          }
        });
      }}
      className={className}
    >
      {isPending ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} /> : children}
    </button>
  );
}
