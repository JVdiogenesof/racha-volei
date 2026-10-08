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
      aria-label={`Autorizar acesso completo de ${fullName}`}
      title={`Autorizar acesso completo de ${fullName}`}
      onClick={() => {
        const confirmed = window.confirm(
          `Autorizar o acesso completo de ${fullName}?\n\nA pessoa deixa de ser convidada de um único racha e passa a usar todas as funções do app.`,
        );
        if (!confirmed) return;

        const formData = new FormData();
        formData.set("profileId", profileId);
        startTransition(async () => {
          try {
            await action(formData);
            showToast(`${fullName} agora tem acesso completo!`);
            router.refresh();
          } catch (err) {
            showToast(err instanceof Error ? err.message : "Não foi possível concluir a ação.");
          }
        });
      }}
      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-green-500/30 bg-green-500/15 text-green-300 hover:bg-green-500/25 disabled:opacity-50 sm:h-auto sm:w-auto sm:gap-1.5 sm:px-3 sm:py-1.5 sm:text-xs sm:font-medium"
    >
      {isPending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
      ) : (
        <UserPlus className="h-3.5 w-3.5" strokeWidth={2} />
      )}
      <span className="hidden sm:inline">Autorizar acesso completo</span>
    </button>
  );
}
