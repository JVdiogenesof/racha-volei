"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { useToast } from "./Toast";

export function DeleteRankingAdjustmentButton({
  adjustmentId,
  action,
}: {
  adjustmentId: string;
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
        const confirmed = window.confirm("Desfazer esse ajuste manual?");
        if (!confirmed) return;

        const formData = new FormData();
        formData.set("id", adjustmentId);
        startTransition(async () => {
          await action(formData);
          showToast("Ajuste desfeito.");
          router.refresh();
        });
      }}
      aria-label="Desfazer ajuste"
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
    >
      {isPending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
      ) : (
        <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
      )}
    </button>
  );
}
