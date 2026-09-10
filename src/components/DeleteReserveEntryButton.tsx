"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { useToast } from "./Toast";

export function DeleteReserveEntryButton({
  id,
  fullName,
  action,
}: {
  id: string;
  fullName: string;
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
        const confirmed = window.confirm(`Remover ${fullName} da lista de reserva?`);
        if (!confirmed) return;

        const formData = new FormData();
        formData.set("id", id);
        startTransition(async () => {
          await action(formData);
          showToast("Removido da lista de reserva.");
          router.refresh();
        });
      }}
      aria-label={`Remover ${fullName}`}
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
