"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eraser, Loader2 } from "lucide-react";
import { useToast } from "./Toast";

export function ClearReservedListButton({ action }: { action: () => Promise<void> }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { showToast } = useToast();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        const confirmed = window.confirm(
          "Limpar a lista inteira de reservados? Use isso só depois que o torneio de verdade acontecer, pra começar o próximo ciclo do zero.",
        );
        if (!confirmed) return;

        startTransition(async () => {
          await action();
          showToast("Lista de reservados zerada.");
          router.refresh();
        });
      }}
      className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm font-medium text-white/70 hover:bg-white/10 disabled:opacity-50"
    >
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
      ) : (
        <Eraser className="h-4 w-4" strokeWidth={2} />
      )}
      Limpar lista (novo ciclo)
    </button>
  );
}
