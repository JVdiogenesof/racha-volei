"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, RotateCcw } from "lucide-react";
import { useToast } from "./Toast";

export function ShirtPaymentButton({ orderId, fullName, paid, action }: { orderId: string; fullName: string; paid: boolean; action: (formData: FormData) => Promise<void> }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const { showToast } = useToast();
  return (
    <button type="button" disabled={pending} onClick={() => {
      const message = paid ? `Voltar o pedido de ${fullName} para aguardando pagamento?` : `Confirmar que ${fullName} pagou este pedido?`;
      if (!window.confirm(message)) return;
      const data = new FormData();
      data.set("orderId", orderId);
      data.set("paid", String(!paid));
      startTransition(async () => {
        try { await action(data); showToast(paid ? "Pedido voltou para pendentes." : "Pagamento confirmado!"); router.refresh(); }
        catch (error) { showToast(error instanceof Error ? error.message : "Não foi possível atualizar."); }
      });
    }} className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-bold transition disabled:opacity-50 ${paid ? "border border-white/10 bg-white/5 text-white/60 hover:bg-white/10" : "bg-green-500 px-4 text-white hover:bg-green-400"}`}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : paid ? <RotateCcw className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
      {paid ? "Desmarcar pagamento" : "Marcar como pago"}
    </button>
  );
}
