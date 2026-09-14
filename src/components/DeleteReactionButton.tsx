"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { X, Loader2 } from "lucide-react";
import { useToast } from "./Toast";

export function DeleteReactionButton({
  reactionId,
  action,
}: {
  reactionId: string;
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
        const formData = new FormData();
        formData.set("reactionId", reactionId);
        startTransition(async () => {
          try {
            await action(formData);
            showToast("Reação removida.");
            router.refresh();
          } catch (e) {
            showToast(e instanceof Error ? e.message : "Não foi possível remover a reação.");
          }
        });
      }}
      aria-label="Remover reação"
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white/30 hover:bg-white/10 hover:text-white/70 disabled:opacity-50"
    >
      {isPending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
      ) : (
        <X className="h-3.5 w-3.5" strokeWidth={2} />
      )}
    </button>
  );
}
