"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Loader2 } from "lucide-react";
import { useToast } from "./Toast";

export function ResetGroupStageButton({
  eventId,
  action,
}: {
  eventId: string;
  action: (formData: FormData) => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { showToast } = useToast();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        const confirmed = window.confirm(
          "Reiniciar a fase de grupos? Todo o placar já lançado (grupo e final) é apagado, e as vagas do Torneio VPA reservadas a partir desse racha são desfeitas.",
        );
        if (!confirmed) return;

        const formData = new FormData();
        formData.set("eventId", eventId);
        startTransition(async () => {
          try {
            await action(formData);
            showToast("Fase de grupos reiniciada.");
            router.refresh();
          } catch (err) {
            showToast(err instanceof Error ? err.message : "Não foi possível concluir a ação.");
          }
        });
      }}
      className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-white/70 hover:bg-white/5 disabled:opacity-50"
    >
      {isPending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
      ) : (
        <RotateCcw className="h-3.5 w-3.5" strokeWidth={2} />
      )}
      Reiniciar fase de grupos
    </button>
  );
}
