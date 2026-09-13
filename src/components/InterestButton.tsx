"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ThumbsUp, Loader2 } from "lucide-react";
import { useToast } from "./Toast";
import { PIX_KEY } from "@/lib/payment";

export function InterestButton({
  eventId,
  price,
  isFull,
  action,
  className,
}: {
  eventId: string;
  price: number | null;
  /** Já tem gente confirmada suficiente pra esse racha (vagas configuradas). */
  isFull?: boolean;
  action: (formData: FormData) => Promise<void> | void;
  className?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { showToast } = useToast();

  function handleClick() {
    const messages: string[] = [];
    if (isFull) {
      messages.push(
        "A lista de confirmados já está cheia. Você só será chamado(a) se alguém desistir — mas mesmo assim vai entrar na lista de interessados agora.",
      );
    }
    if (price) {
      messages.push(
        `Sua vaga NÃO está garantida só por marcar interesse.\n\nEfetue o pagamento de R$ ${price.toFixed(2)} via Pix pra entrar na lista de confirmados.\n\nChave Pix: ${PIX_KEY}`,
      );
    }
    if (messages.length) {
      const confirmed = window.confirm(messages.join("\n\n"));
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
