"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { X, Loader2 } from "lucide-react";
import { useToast } from "./Toast";

export function CancelAttendanceButton({
  eventId,
  action,
  className,
}: {
  eventId: string;
  action: (formData: FormData) => Promise<void> | void;
  className?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { showToast } = useToast();

  function handleClick() {
    const confirmed = window.confirm(
      "Tem certeza que não vai mais poder ir nesse racha?\n\nVocê vai sair da lista de confirmados.",
    );
    if (!confirmed) return;

    const formData = new FormData();
    formData.set("eventId", eventId);
    formData.set("status", "declined");

    startTransition(async () => {
      try {
        await action(formData);
        showToast("Você marcou que não vai mais.");
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
      className={
        className ??
        "inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm font-medium text-white/70 hover:bg-white/10 disabled:opacity-50"
      }
    >
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
      ) : (
        <X className="h-4 w-4" strokeWidth={2} />
      )}
      Não vou mais poder ir
    </button>
  );
}
