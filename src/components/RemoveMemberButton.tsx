"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserX, Loader2 } from "lucide-react";
import { useToast } from "./Toast";

export function RemoveMemberButton({
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
          `Remover ${fullName} do grupo? A pessoa perde o acesso ao site, mas o histórico dela (presenças, vezes destaque, vitórias) fica registrado.`,
        );
        if (!confirmed) return;

        const formData = new FormData();
        formData.set("profileId", profileId);
        startTransition(async () => {
          try {
            await action(formData);
            showToast(`${fullName} foi removido(a) do grupo.`);
            router.refresh();
          } catch (err) {
            showToast(err instanceof Error ? err.message : "Não foi possível remover.");
          }
        });
      }}
      className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/15 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20 disabled:opacity-50"
    >
      {isPending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
      ) : (
        <UserX className="h-3.5 w-3.5" strokeWidth={2} />
      )}
      Remover do grupo
    </button>
  );
}
