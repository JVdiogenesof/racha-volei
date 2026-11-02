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
  pixPaymentEnabled = false,
  action,
  className,
}: {
  eventId: string;
  price: number | null;
  /** Já tem gente confirmada suficiente pra esse racha (vagas configuradas). */
  isFull?: boolean;
  /** Racha com Pix automático: o pagamento é gerado na tela da lista, nunca na chave fixa. */
  pixPaymentEnabled?: boolean;
  action: (formData: FormData) => Promise<void> | void;
  className?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { showToast } = useToast();

  function handleClick() {
    // Lista cheia: não fala em pagamento nenhum. Qualquer Pix agora (na
    // chave ou não) não vira vaga -- a pessoa só entra na fila.
    let message: string | null = null;
    if (isFull) {
      message =
        "A lista já está cheia. Você entra na fila de espera e só é chamado(a) se alguém desistir.\n\nNão pague nada agora.";
    } else if (price && pixPaymentEnabled) {
      message = `Só marcar não garante a vaga.\n\nNa próxima tela, gere o Pix de R$ ${price.toFixed(2)} e pague com o código gerado. Não pague direto na chave do grupo: o sistema não confirma seu nome.`;
    } else if (price) {
      message = `Só marcar não garante a vaga.\n\nPara entrar na lista, pague R$ ${price.toFixed(2)} por Pix.\n\nChave Pix: ${PIX_KEY}`;
    }
    if (message && !window.confirm(message)) return;

    const formData = new FormData();
    formData.set("eventId", eventId);
    formData.set("status", "interested");

    startTransition(async () => {
      try {
        await action(formData);
        showToast(isFull ? "Você entrou na fila de espera." : "Pedido registrado!");
        if (pixPaymentEnabled && price && !isFull) {
          router.push(`/racha/${eventId}/confirmar`);
        } else {
          router.refresh();
        }
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
      {isFull ? "Entrar na fila de espera" : "Quero jogar"}
    </button>
  );
}
