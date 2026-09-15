"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Loader2 } from "lucide-react";
import { useToast } from "./Toast";

export function MakePermanentButton({
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
        const confirmed = window.confirm(
          `Tornar ${fullName} um membro permanente do grupo?\n\nEla deixa de ter acesso só a esse racha e passa a ver o site igual todo mundo.`,
        );
        if (!confirmed) return;

        const formData = new FormData();
        formData.set("profileId", profileId);
        startTransition(async () => {
          try {
            await action(formData);
            showToast(`${fullName} agora é membro permanente!`);
            router.refresh();
          } catch (err) {
            showToast(err instanceof Error ? err.message : "Não foi possível concluir a ação.");
          }
        });
      }}
      className="inline-flex items-center gap-1.5 rounded-lg border border-green-500/30 bg-green-500/15 px-3 py-1.5 text-xs font-medium text-green-300 hover:bg-green-500/25 disabled:opacity-50"
    >
      {isPending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
      ) : (
        <UserPlus className="h-3.5 w-3.5" strokeWidth={2} />
      )}
      Tornar acesso permanente
    </button>
  );
}
