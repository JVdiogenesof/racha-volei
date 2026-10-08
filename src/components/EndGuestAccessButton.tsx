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
      aria-label={`Encerrar o acesso temporário de ${fullName}`}
      title={`Encerrar o acesso temporário de ${fullName}`}
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
      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 text-white/70 hover:bg-white/5 disabled:opacity-50 sm:h-auto sm:w-auto sm:gap-1.5 sm:px-3 sm:py-1.5 sm:text-xs sm:font-medium"
    >
      {isPending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
      ) : (
        <XCircle className="h-3.5 w-3.5" strokeWidth={2} />
      )}
      <span className="hidden sm:inline">Encerrar acesso</span>
    </button>
  );
}
