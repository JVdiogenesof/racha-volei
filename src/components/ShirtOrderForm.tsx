"use client";

import Image from "next/image";
import { useActionState, useEffect, useState } from "react";
import { Check, Loader2, ShoppingBag, Sparkles } from "lucide-react";
import { useToast } from "./Toast";
import { getShirtModels, SHIRT_SIZES, type ShirtModel, type ShirtModelInfo } from "@/lib/shirts";
import type { Community } from "@/lib/community";
import type { ShirtOrderState } from "@/app/(app)/camisas/actions";

type ExistingOrder = {
  model: ShirtModel;
  shirt_name: string;
  shirt_number: number;
  size: string;
  quantity: number;
  paid: boolean;
};

const initialState: ShirtOrderState = { status: "idle", message: "" };

export function ShirtOrderForm({
  action,
  existingOrders,
  community,
}: {
  action: (state: ShirtOrderState, formData: FormData) => Promise<ShirtOrderState>;
  existingOrders: ExistingOrder[];
  community: Community;
}) {
  const shirtModels = getShirtModels(community);
  const [model, setModel] = useState<ShirtModel>("tank");
  const [state, formAction, pending] = useActionState(action, initialState);
  const { showToast } = useToast();
  const existing = existingOrders.find((order) => order.model === model);

  useEffect(() => {
    if (state.status !== "idle") showToast(state.message);
  }, [state, showToast]);

  return (
    <section id="fazer-pedido" className="scroll-mt-36 rounded-3xl border border-purple-300/20 bg-gradient-to-br from-purple-500/10 via-white/[0.025] to-transparent p-4 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-purple-500/20 text-purple-200"><ShoppingBag className="h-5 w-5" /></span>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-purple-300">Monte seu pedido</p>
          <h2 className="mt-1 text-xl font-black text-white">Escolha primeiro o modelo</h2>
          <p className="mt-1 text-sm text-white/55">Quer os dois? Finalize um modelo e depois faça o pedido do outro.</p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {(Object.entries(shirtModels) as [ShirtModel, ShirtModelInfo][]).map(([key, item]) => {
          const selected = model === key;
          const saved = existingOrders.find((order) => order.model === key);
          return (
            <button
              key={key}
              type="button"
              onClick={() => setModel(key)}
              className={`group overflow-hidden rounded-2xl border text-left transition ${selected ? "border-purple-300 bg-purple-500/15 shadow-lg shadow-purple-950/30" : "border-white/10 bg-white/[0.03] hover:border-white/20"}`}
            >
              <div className={`relative overflow-hidden ${community === "sand" ? "aspect-[4/5] bg-[#191919]" : "aspect-[16/9]"}`}>
                <Image src={item.image} alt={`Camisa VPA modelo ${item.label}`} fill sizes="(max-width: 640px) 100vw, 50vw" className={`${community === "sand" ? "object-contain object-center" : "object-cover"} transition duration-500 group-hover:scale-[1.02]`} />
                {selected && <span className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-purple-600 text-white shadow"><Check className="h-4 w-4" /></span>}
                {saved && <span className="absolute bottom-3 left-3 rounded-full bg-black/70 px-3 py-1 text-xs font-bold text-white backdrop-blur">{saved.paid ? "Pago" : "Pedido salvo"}</span>}
              </div>
              <div className="p-4"><p className="font-bold text-white">{item.label}</p><p className="mt-1 text-xs text-white/50">{item.description}</p></div>
            </button>
          );
        })}
      </div>

      <form action={formAction} key={`${model}-${existing?.shirt_name ?? "new"}`} className="mt-5 grid gap-4 rounded-2xl border border-white/10 bg-black/15 p-4 sm:grid-cols-2 sm:p-5">
        <input type="hidden" name="model" value={model} />
        <div className="relative overflow-hidden rounded-xl border border-white/10 sm:col-span-2">
          <div className={`relative ${community === "sand" ? "aspect-[4/5] bg-[#191919] sm:aspect-[16/11]" : "aspect-[16/8] sm:aspect-[16/6]"}`}>
            <Image src={shirtModels[model].image} alt={`Modelo selecionado: ${shirtModels[model].label}`} fill priority sizes="(max-width: 640px) 100vw, 720px" className={community === "sand" ? "object-contain object-center" : "object-cover"} />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-4 pb-4 pt-12">
              <p className="flex items-center gap-2 text-lg font-black text-white"><Sparkles className="h-4 w-4 text-purple-300" />Modelo {shirtModels[model].label}</p>
            </div>
          </div>
        </div>

        <label className="text-sm font-medium text-white">Nome na camisa
          <input name="shirtName" required maxLength={20} defaultValue={existing?.shirt_name ?? ""} placeholder="Ex.: Diógenes" className={inputClass} />
        </label>
        <label className="text-sm font-medium text-white">Número
          <input name="shirtNumber" required inputMode="numeric" pattern="[0-9]{1,2}" maxLength={2} defaultValue={existing ? String(existing.shirt_number).padStart(2, "0") : ""} placeholder="Ex.: 05" className={inputClass} />
        </label>

        <fieldset className="sm:col-span-2">
          <legend className="text-sm font-medium text-white">Tamanho</legend>
          <div className="mt-2 grid grid-cols-5 gap-2">
            {SHIRT_SIZES.map((size) => (
              <label key={size} className="cursor-pointer">
                <input type="radio" name="size" value={size} required defaultChecked={(existing?.size ?? "M") === size} className="peer sr-only" />
                <span className="flex min-h-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-sm font-bold text-white/70 transition peer-checked:border-purple-300 peer-checked:bg-purple-500/25 peer-checked:text-white">{size}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className="text-sm font-medium text-white sm:col-span-2">Quantidade deste modelo
          <select name="quantity" defaultValue={existing?.quantity ?? 1} className={inputClass}>
            {[1, 2, 3, 4, 5].map((quantity) => <option key={quantity} value={quantity}>{quantity} {quantity === 1 ? "camisa" : "camisas"}</option>)}
          </select>
        </label>

        {existing?.paid && <p className="rounded-xl border border-green-400/20 bg-green-500/10 p-3 text-sm text-green-200 sm:col-span-2">Pagamento confirmado. Este pedido está fechado; fale com um organizador se precisar alterar.</p>}
        <button type="submit" disabled={pending || existing?.paid} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-purple-600 px-5 font-bold text-white shadow-lg shadow-purple-950/30 transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-2">
          {pending ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShoppingBag className="h-5 w-5" />}
          {existing ? "Atualizar este pedido" : `Pedir modelo ${shirtModels[model].label}`}
        </button>
        <p aria-live="polite" className={`text-center text-sm sm:col-span-2 ${state.status === "error" ? "text-red-300" : "text-green-300"}`}>{state.message}</p>
      </form>
    </section>
  );
}

const inputClass = "mt-1.5 min-h-11 w-full rounded-xl border border-white/15 bg-white/[0.05] px-3 py-2.5 text-white placeholder:text-white/30 focus:border-purple-300 focus:outline-none focus:ring-1 focus:ring-purple-300";
