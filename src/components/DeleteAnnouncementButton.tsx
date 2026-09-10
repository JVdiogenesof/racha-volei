"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { useToast } from "./Toast";

export function DeleteAnnouncementButton({
  announcementId,
  action,
}: {
  announcementId: string;
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
        formData.set("announcementId", announcementId);
        startTransition(async () => {
          try {
            await action(formData);
            showToast("Aviso removido.");
            router.refresh();
          } catch (e) {
            showToast(e instanceof Error ? e.message : "Não foi possível remover o aviso.");
          }
        });
      }}
      aria-label="Remover aviso"
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
