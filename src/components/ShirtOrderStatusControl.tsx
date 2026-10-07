"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { SHIRT_ORDER_STATUS_LABELS, type ShirtOrderStatus } from "@/lib/shirts";
import { useToast } from "./Toast";

export function ShirtOrderStatusControl({ orderId, status, hasPayment, label, action }: {
  orderId: string;
  status: ShirtOrderStatus;
  hasPayment: boolean;
  label: string;
  action: (data: FormData) => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const { showToast } = useToast();
  return <label className="mt-3 block text-xs text-white/60">
    Andamento do pedido
    <span className="mt-1 flex items-center gap-2">
      <select aria-label={`Andamento de ${label}`} value={status} disabled={pending}
        className={`min-h-10 w-full min-w-0 rounded-xl border px-2 text-xs font-semibold disabled:opacity-60 ${status === "delivered" ? "border-emerald-300/30 bg-[#12382f] text-emerald-200" : "border-purple-300/20 bg-[#21123d] text-purple-100"}`}
        onChange={(event) => {
          const data = new FormData();
          data.set("orderId", orderId);
          data.set("status", event.target.value);
          startTransition(async () => {
            try { await action(data); showToast("Andamento atualizado!"); router.refresh(); }
            catch (error) { showToast(error instanceof Error ? error.message : "Não foi possível atualizar."); }
          });
        }}>
        {(Object.entries(SHIRT_ORDER_STATUS_LABELS) as [ShirtOrderStatus, string][]).map(([value, text]) =>
          <option key={value} value={value}>{value === "awaiting_payment" && hasPayment ? "Aguardando pedido à loja" : text}</option>)}
      </select>
      {pending && <Loader2 aria-label="Salvando andamento" className="h-4 w-4 shrink-0 animate-spin" />}
    </span>
  </label>;
}
