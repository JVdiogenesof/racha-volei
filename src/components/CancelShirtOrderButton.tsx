"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { useToast } from "./Toast";

export function CancelShirtOrderButton({ orderId, model, action }: { orderId: string; model: string; action: (formData: FormData) => Promise<void> }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const { showToast } = useToast();
  return (
    <button type="button" disabled={pending} onClick={() => {
      if (!window.confirm(`Cancelar o pedido do modelo ${model}?`)) return;
      const data = new FormData();
      data.set("orderId", orderId);
      startTransition(async () => {
        try { await action(data); showToast("Pedido cancelado."); router.refresh(); }
        catch (error) { showToast(error instanceof Error ? error.message : "Não foi possível cancelar."); }
      });
    }} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-red-400/20 px-3 text-xs font-semibold text-red-300 hover:bg-red-500/10 disabled:opacity-50">
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}Cancelar
    </button>
  );
}
