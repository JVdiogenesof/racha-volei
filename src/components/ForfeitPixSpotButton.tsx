"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { X, Loader2 } from "lucide-react";
import { useToast } from "./Toast";

/** Desistência simples de quem pagou no Pix: sai da lista sem saldo nem reembolso. */
export function ForfeitPixSpotButton({
  eventId,
  action,
}: {
  eventId: string;
  action: (formData: FormData) => Promise<void> | void;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { showToast } = useToast();

  function handleClick() {
    const confirmed = window.confirm(
      "Desistir da vaga?\n\nVocê sai da lista de confirmados e NÃO recebe saldo nem reembolso. A vaga é oferecida na hora pra próxima pessoa da lista de interessados.",
    );
    if (!confirmed) return;

    const formData = new FormData();
    formData.set("eventId", eventId);
    formData.set("choice", "forfeit");

    startTransition(async () => {
      try {
        await action(formData);
        showToast("Você desistiu da vaga. Ela foi oferecida pra próxima pessoa da fila.");
        router.refresh();
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Não foi possível concluir a ação.");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-red-300/25 bg-red-400/10 px-3 text-sm font-semibold text-red-100 hover:bg-red-400/20 disabled:opacity-50"
    >
      {isPending ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} /> : <X className="h-4 w-4" strokeWidth={2} />}
      Desistir da vaga
    </button>
  );
}
