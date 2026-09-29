"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserMinus, Loader2 } from "lucide-react";
import { useToast } from "./Toast";

export function RemoveAttendanceButton({
  eventId,
  profileId,
  fullName,
  action,
  showMobileLabel = false,
}: {
  eventId: string;
  profileId: string;
  fullName: string;
  action: (formData: FormData) => Promise<void>;
  showMobileLabel?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { showToast } = useToast();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        const confirmed = window.confirm(`Remover ${fullName} da lista de confirmados desse racha?`);
        if (!confirmed) return;

        const formData = new FormData();
        formData.set("eventId", eventId);
        formData.set("profileId", profileId);
        startTransition(async () => {
          await action(formData);
          showToast("Removido da lista.");
          router.refresh();
        });
      }}
      aria-label={`Remover ${fullName}`}
      className={
        showMobileLabel
          ? "flex h-10 w-full items-center justify-center gap-1.5 rounded-lg border border-red-300/15 bg-red-400/5 px-2 text-xs font-medium text-red-200/70 hover:bg-red-500/15 hover:text-red-300 disabled:opacity-50 sm:h-9 sm:w-9 sm:rounded-full sm:px-0"
          : "ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white/40 hover:bg-red-500/15 hover:text-red-400 disabled:opacity-50"
      }
    >
      {isPending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
      ) : (
        <UserMinus className="h-3.5 w-3.5" strokeWidth={2} />
      )}
      {showMobileLabel && <span className="sm:hidden">Remover</span>}
    </button>
  );
}
