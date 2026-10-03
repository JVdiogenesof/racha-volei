"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { useToast } from "./Toast";

export function DeleteShirtOrderButton({
  orderId,
  fullName,
  model,
  action,
}: {
  orderId: string;
  fullName: string;
  model: string;
  action: (formData: FormData) => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const { showToast } = useToast();

  return (
    <button
      type="button"
      disabled={pending}
      aria-label={`Excluir pedido ${model} de ${fullName}`}
      onClick={() => {
        if (!window.confirm(`Excluir o pedido ${model} de ${fullName}? Essa ação também remove o status de pagamento dessa peça.`)) return;
        const data = new FormData();
        data.set("orderId", orderId);
        startTransition(async () => {
          try {
            await action(data);
            showToast(`Pedido ${model} excluído.`);
            router.refresh();
          } catch (error) {
            showToast(error instanceof Error ? error.message : "Não foi possível excluir o pedido.");
          }
        });
      }}
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-red-400/25 bg-red-500/10 text-red-300 transition hover:bg-red-500/20 disabled:opacity-50"
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
    </button>
  );
}
