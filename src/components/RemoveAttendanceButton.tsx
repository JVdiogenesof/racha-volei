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
}: {
  eventId: string;
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
      className="ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
    >
      {isPending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
      ) : (
        <UserMinus className="h-3.5 w-3.5" strokeWidth={2} />
      )}
    </button>
  );
}
