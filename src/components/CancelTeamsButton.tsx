"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { useToast } from "./Toast";

export function CancelTeamsButton({
  eventId,
  action,
}: {
  eventId: string;
  action: (formData: FormData) => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { showToast } = useToast();

  function cancelTeams() {
    const confirmed = window.confirm(
      "Cancelar os times gerados? A formação atual será apagada, mas a lista de confirmados e as configurações do racha serão mantidas.",
    );
    if (!confirmed) return;

    const formData = new FormData();
    formData.set("eventId", eventId);
    startTransition(async () => {
      try {
        await action(formData);
        showToast("Times cancelados. Você pode gerar uma nova formação quando quiser.");
        router.refresh();
      } catch (error) {
        showToast(error instanceof Error ? error.message : "Não foi possível cancelar os times.");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={cancelTeams}
      disabled={isPending}
      aria-label="Cancelar formação dos times"
      title="Cancelar formação dos times"
      className="flex h-11 w-11 items-center justify-center rounded-full border border-red-300/25 bg-red-400/10 text-red-200 hover:bg-red-400/20 disabled:opacity-50"
    >
      {isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Trash2 className="h-5 w-5" strokeWidth={2} />}
    </button>
  );
}
