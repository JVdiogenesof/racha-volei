"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { SHIRT_PAYMENT_LABELS, type ShirtPayment } from "@/lib/shirts";
import { useToast } from "./Toast";

export function ShirtPaymentButton({ profileId, orderIds, fullName, payment, action }: {
  profileId: string; orderIds: string[]; fullName: string; payment: ShirtPayment;
  action: (data: FormData) => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const { showToast } = useToast();
  return <div className="flex flex-wrap gap-2" aria-label={"Pagamento de " + fullName}>
    {(["pending", "half", "paid"] as const).map((status) => <button key={status} type="button"
      disabled={pending || payment === status} aria-pressed={payment === status}
      className="min-h-10 rounded-xl border border-white/15 bg-white/5 px-3 text-xs font-bold text-white transition hover:bg-purple-500/20 aria-pressed:border-purple-300 aria-pressed:bg-purple-500/25 disabled:opacity-60"
      onClick={() => {
        if (!window.confirm("Marcar todas as peças exibidas de " + fullName + " como “" + SHIRT_PAYMENT_LABELS[status] + "”?")) return;
        const data = new FormData();
        data.set("profileId", profileId);
        data.set("payment", status);
        orderIds.forEach((id) => data.append("orderId", id));
        startTransition(async () => {
          try { await action(data); showToast("Pagamento atualizado!"); router.refresh(); }
          catch (error) { showToast(error instanceof Error ? error.message : "Não foi possível atualizar."); }
        });
      }}>{SHIRT_PAYMENT_LABELS[status]}</button>)}
    {pending && <Loader2 aria-label="Salvando pagamento" className="h-4 w-4 animate-spin" />}
  </div>;
}
