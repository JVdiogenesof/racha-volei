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
  label,
}: {
  eventId: string;
  price: number | null;
  /** Já tem gente confirmada suficiente pra esse racha (vagas configuradas). */
  isFull?: boolean;
  /** Racha com Pix automático: marca o interesse e já abre o pagamento na tela da lista. */
  pixPaymentEnabled?: boolean;
  action: (formData: FormData) => Promise<void> | void;
  className?: string;
  /** Troca o texto do botão, quando falta espaço. */
  label?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { showToast } = useToast();

  function handleClick() {
    const goesToPix = Boolean(pixPaymentEnabled && price && !isFull);
    // Lista cheia: não fala em pagamento nenhum. Qualquer Pix agora (na
    // chave ou não) não vira vaga -- a pessoa só entra na fila.
    let message: string | null = null;
    if (isFull) {
      message =
        "A lista já está cheia. Você entra na fila de espera e só é chamado(a) se alguém desistir.\n\nNão pague nada agora.";
    } else if (price && !goesToPix) {
      message = `Só marcar não garante a vaga.\n\nPara entrar na lista, pague R$ ${price.toFixed(2)} por Pix.\n\nChave Pix: ${PIX_KEY}`;
    }
    if (message && !window.confirm(message)) return;

    const formData = new FormData();
    formData.set("eventId", eventId);
    formData.set("status", "interested");

    startTransition(async () => {
      try {
        await action(formData);
        if (goesToPix) {
          router.push(`/racha/${eventId}/confirmar?pagar=1`);
        } else {
          showToast(isFull ? "Você entrou na fila de espera." : "Pedido registrado!");
          router.refresh();
        }
      } catch (err) {
        // Em produção o Next esconde o texto do erro da action.
        const message = err instanceof Error ? err.message : "";
        showToast(!message || /server component/i.test(message) ? "Não foi possível concluir. Tente de novo." : message);
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
      {label ?? (isFull ? "Entrar na fila de espera" : "Quero jogar")}
    </button>
  );
}
