"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { useToast } from "./Toast";

export function DeleteReactionTypeButton({
  reactionTypeId,
  action,
}: {
  reactionTypeId: string;
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
          "Apagar essa reação de vez? As reações já mandadas com ela somem do feed também. Pra só parar de oferecer ela, use \"Desativar\" em vez disso.",
        );
        if (!confirmed) return;

        const formData = new FormData();
        formData.set("id", reactionTypeId);
        startTransition(async () => {
          try {
            await action(formData);
            showToast("Reação apagada.");
            router.refresh();
          } catch (e) {
            showToast(e instanceof Error ? e.message : "Não foi possível apagar.");
          }
        });
      }}
      aria-label="Apagar reação"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-red-500/30 bg-red-500/15 text-red-400 hover:bg-red-500/20 disabled:opacity-50"
    >
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
      ) : (
        <Trash2 className="h-4 w-4" strokeWidth={2} />
      )}
    </button>
  );
}
