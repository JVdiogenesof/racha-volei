"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, X } from "lucide-react";
import { SHIRT_FITS, SHIRT_MODELS, SHIRT_SIZES, type ShirtFit, type ShirtModel } from "@/lib/shirts";
import { useToast } from "./Toast";

type EditableShirtOrder = {
  id: string;
  model: ShirtModel;
  fit: ShirtFit;
  shirtName: string;
  shirtNumber: number;
  size: string;
  quantity: number;
};

export function EditShirtOrderButton({ order, fullName, action }: {
  order: EditableShirtOrder;
  fullName: string;
  action: (formData: FormData) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const { showToast } = useToast();

  return <>
    <button type="button" onClick={() => setOpen(true)} aria-label={`Editar pedido de ${fullName}`}
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-purple-300/25 bg-purple-500/10 text-purple-200 transition hover:bg-purple-500/20 active:scale-95">
      <Pencil className="h-4 w-4" />
    </button>

    {open && <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !pending) setOpen(false);
    }}>
      <section role="dialog" aria-modal="true" aria-labelledby={`edit-shirt-${order.id}`}
        className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-white/15 bg-[#171122] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:max-w-lg sm:rounded-3xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div><p className="text-xs font-bold uppercase tracking-wider text-purple-300">Editar pedido</p><h2 id={`edit-shirt-${order.id}`} className="mt-1 text-xl font-black text-white">{fullName}</h2></div>
          <button type="button" disabled={pending} onClick={() => setOpen(false)} aria-label="Fechar edição" className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"><X className="h-5 w-5" /></button>
        </div>

        <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          data.set("orderId", order.id);
          startTransition(async () => {
            try {
              await action(data);
              showToast("Pedido atualizado!");
              setOpen(false);
              router.refresh();
            } catch (error) {
              showToast(error instanceof Error ? error.message : "Não foi possível editar o pedido.");
            }
          });
        }}>
          <label className="text-sm font-semibold text-white/80">Modelo<select name="model" defaultValue={order.model} className={inputClass}>{Object.entries(SHIRT_MODELS).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}</select></label>
          <label className="text-sm font-semibold text-white/80">Modelagem<select name="fit" defaultValue={order.fit} className={inputClass}>{Object.entries(SHIRT_FITS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="text-sm font-semibold text-white/80">Nome na camisa<input name="shirtName" required maxLength={20} defaultValue={order.shirtName} className={inputClass} /></label>
          <label className="text-sm font-semibold text-white/80">Número<input name="shirtNumber" required inputMode="numeric" pattern="[0-9]{1,2}" maxLength={2} defaultValue={String(order.shirtNumber).padStart(2, "0")} className={inputClass} /></label>
          <label className="text-sm font-semibold text-white/80">Tamanho<select name="size" defaultValue={order.size} className={inputClass}>{SHIRT_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}</select></label>
          <label className="text-sm font-semibold text-white/80">Quantidade<input name="quantity" type="number" min={1} max={20} required defaultValue={order.quantity} className={inputClass} /></label>
          <p className="rounded-xl border border-amber-300/15 bg-amber-400/[0.07] p-3 text-xs leading-relaxed text-amber-100/75 sm:col-span-2">Se o pedido já tiver pagamento, qualquer mudança de modelo ou quantidade também ajustará o valor no caixa das camisas.</p>
          <button type="submit" disabled={pending} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-purple-600 px-5 font-black text-white transition hover:bg-purple-500 active:scale-[.98] disabled:opacity-60 sm:col-span-2">
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}{pending ? "Salvando..." : "Salvar alterações"}
          </button>
        </form>
      </section>
    </div>}
  </>;
}

const inputClass = "mt-1.5 min-h-11 w-full rounded-xl border border-white/15 bg-[#241834] px-3 py-2.5 text-white outline-none focus:border-purple-300 focus:ring-1 focus:ring-purple-300";
