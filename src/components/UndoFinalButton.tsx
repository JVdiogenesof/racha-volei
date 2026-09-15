"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Undo2, Loader2 } from "lucide-react";
import { useToast } from "./Toast";

export function UndoFinalButton({
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
          "Desfazer a final e a disputa de 3º lugar? Os placares de grupo continuam intactos. Se a final já tinha resultado, as vagas do Torneio VPA reservadas a partir desse racha também são desfeitas.",
        );
        if (!confirmed) return;

        const formData = new FormData();
        formData.set("eventId", eventId);
        startTransition(async () => {
          try {
            await action(formData);
            showToast("Final e disputa de 3º lugar desfeitas.");
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
        <Undo2 className="h-3.5 w-3.5" strokeWidth={2} />
      )}
      Desfazer final
    </button>
  );
}
