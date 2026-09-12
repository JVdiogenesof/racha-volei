"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ThumbsUp, Loader2 } from "lucide-react";
import { useToast } from "./Toast";

export function InterestButton({
  eventId,
  price,
  action,
  className,
}: {
  eventId: string;
  price: number | null;
  action: (formData: FormData) => Promise<void> | void;
  className?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { showToast } = useToast();

  function handleClick() {
    if (price) {
      const confirmed = window.confirm(
        `Sua vaga NÃO está garantida só por marcar interesse.\n\nEfetue o pagamento de R$ ${price.toFixed(2)} pra entrar na lista de confirmados.`,
      );
      if (!confirmed) return;
    }

    const formData = new FormData();
    formData.set("eventId", eventId);
    formData.set("status", "interested");

    startTransition(async () => {
      try {
        await action(formData);
        showToast("Interesse registrado!");
        router.refresh();
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Não foi possível concluir a ação.");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className={
        className ??
        "inline-flex items-center gap-1.5 rounded-lg bg-brand-purple px-4 py-2 font-medium text-white hover:bg-brand-purple-dark disabled:opacity-50"
      }
    >
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
      ) : (
        <ThumbsUp className="h-4 w-4" strokeWidth={2} />
      )}
      Tenho interesse
    </button>
  );
}
