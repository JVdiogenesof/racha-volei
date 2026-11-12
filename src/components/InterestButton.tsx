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
  secondBatchOpensLabel = null,
  batchSettersFull = false,
  pixPaymentEnabled = false,
  action,
  className,
}: {
  eventId: string;
  price: number | null;
  /** Já tem gente confirmada suficiente pra esse racha (vagas configuradas). */
  isFull?: boolean;
  /** Lote 1 esgotado: quando o Lote 2 abre (ex.: "sexta-feira, 13/11 às 12:00"). */
  secondBatchOpensLabel?: string | null;
  /** Levantador barrado: Lote 1 cheio e a cota de levantadores do lote já preenchida. */
  batchSettersFull?: boolean;
  /** Racha com Pix automático: marca o interesse e já abre o pagamento na tela da lista. */
  pixPaymentEnabled?: boolean;
  action: (formData: FormData) => Promise<void> | void;
  className?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { showToast } = useToast();

  function handleClick() {
    const goesToPix = Boolean(pixPaymentEnabled && price && !isFull);
    // Lista cheia: não fala em pagamento nenhum. Qualquer Pix agora (na
    // chave ou não) não vira vaga -- a pessoa só entra na fila.
    let message: string | null = null;
    if (isFull && secondBatchOpensLabel && batchSettersFull) {
      message = `A cota de levantadores do Lote 1 já foi preenchida e o lote lotou.\n\nVocê pode entrar na fila de espera como jogador(a) normal (é chamado(a) se alguém desistir) ou esperar o Lote 2, que abre ${secondBatchOpensLabel} e tem vaga guardada para levantador.\n\nNão pague nada agora.`;
    } else if (isFull && secondBatchOpensLabel) {
      message = `O Lote 1 esgotou. As próximas vagas (Lote 2) abrem ${secondBatchOpensLabel}, e quem pagar primeiro garante.\n\nMarcando interesse agora você entra na fila e pode ser chamado(a) antes, se alguém do Lote 1 desistir.\n\nNão pague nada agora.`;
    } else if (isFull) {
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
      {isFull ? "Entrar na fila de espera" : "Quero jogar"}
    </button>
  );
}
