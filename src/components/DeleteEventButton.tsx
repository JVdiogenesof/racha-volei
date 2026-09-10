"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { useToast } from "./Toast";

export function DeleteEventButton({
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
          "Excluir esse racha? Presença, times e MVP dele também são apagados. Essa ação não pode ser desfeita.",
        );
        if (!confirmed) return;

        const formData = new FormData();
        formData.set("eventId", eventId);
        startTransition(async () => {
          await action(formData);
          showToast("Racha excluído.");
          router.refresh();
        });
      }}
      aria-label="Excluir racha"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50"
    >
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
      ) : (
        <Trash2 className="h-4 w-4" strokeWidth={2} />
      )}
    </button>
  );
}
