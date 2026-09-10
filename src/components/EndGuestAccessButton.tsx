"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { XCircle, Loader2 } from "lucide-react";
import { useToast } from "./Toast";

export function EndGuestAccessButton({
  profileId,
  fullName,
  action,
}: {
  profileId: string;
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
        const confirmed = window.confirm(`Encerrar o acesso temporário de ${fullName}?`);
        if (!confirmed) return;

        const formData = new FormData();
        formData.set("profileId", profileId);
        startTransition(async () => {
          await action(formData);
          showToast("Acesso encerrado.");
          router.refresh();
        });
      }}
      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
    >
      {isPending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
      ) : (
        <XCircle className="h-3.5 w-3.5" strokeWidth={2} />
      )}
      Encerrar acesso
    </button>
  );
}
