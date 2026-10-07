import Image from "next/image";
import Link from "next/link";
import { CheckCircle2, Eye, ShieldCheck, Shirt, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { shirtOrderStatusLabel, type ShirtOrderStatus, SHIRT_FITS, SHIRT_PAYMENT_LABELS, SHIRT_PRICES, shirtOrderTotal, shirtPayment, type ShirtFit, formatShirtNumber, getShirtCollectionImage, getShirtModels, type ShirtModel } from "@/lib/shirts";
import { getActiveCommunity } from "@/lib/community";
import { ShirtOrderForm } from "@/components/ShirtOrderForm";
import { CancelShirtOrderButton } from "@/components/CancelShirtOrderButton";
import { cancelShirtOrder, saveShirtOrder, updateShirtFit } from "./actions";

import { ActionForm } from "@/components/ActionForm";

type Order = { id: string; model: ShirtModel; shirt_name: string; shirt_number: number; size: string; quantity: number; paid: boolean; half_paid: boolean; fulfillment_status: ShirtOrderStatus; fit: ShirtFit; created_at: string };

export default async function CamisasPage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const community = await getActiveCommunity(profile);
  const shirtModels = getShirtModels(community);
  const { data, error } = await supabase.from("shirt_orders").select("id, model, shirt_name, shirt_number, size, quantity, paid, half_paid, fulfillment_status, fit, created_at").eq("profile_id", profile.id).eq("community", community).order("created_at");
  if (error) throw new Error(error.message);
  const orders = (data ?? []) as Order[];
  const canOrder = profile.status === "approved";

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-purple-300/20 bg-[#1b0b38] shadow-2xl shadow-purple-950/25">
        <div className={`relative ${community === "sand" ? "aspect-[8/5]" : "aspect-square sm:aspect-[16/10] lg:aspect-[16/8]"}`}>
          <Image src={getShirtCollectionImage(community)} alt={`Coleção VPA ${community === "sand" ? "de areia" : "de quadra"} com os modelos de manga e regata`} fill priority sizes="(max-width: 1024px) 100vw, 960px" className={community === "sand" ? "object-contain object-center" : "object-cover"} />
          <div className="absolute inset-0 bg-gradient-to-t from-[#100620] via-transparent to-black/10" />
          <div className="absolute inset-x-0 bottom-0 p-5 sm:p-8">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-200/20 bg-black/35 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-purple-100 backdrop-blur"><Sparkles className="h-3.5 w-3.5" />Nova coleção</span>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-5xl">A nova pele do VPA</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-white/75 sm:text-base">Escolha seu modelo, personalize nome e número e garanta sua nova camisa.</p>
          </div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
        {[{ icon: Shirt, title: "2 modelos", text: "Regata ou com manga" }, { icon: Sparkles, title: "Do seu jeito", text: "Nome, número e tamanho" }, { icon: CheckCircle2, title: "Pedido organizado", text: "Acompanhe o pagamento" }].map((item) => (
          <div key={item.title} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-4"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-500/15 text-purple-300"><item.icon className="h-5 w-5" /></span><div><p className="font-bold text-white">{item.title}</p><p className="text-xs text-white/45">{item.text}</p></div></div>
        ))}
      </div>

      {orders.length > 0 && (
        <section className="rounded-2xl border border-white/10 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div><h2 className="text-lg font-bold">Meu pedido</h2>
              <p className="text-sm text-white/50">{orders.reduce((n, o) => n + o.quantity, 0)} peças · {orders.reduce((sum, order) => sum + shirtOrderTotal(order), 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} · {community === "sand" ? "Areia" : "Quadra"}</p></div>
            {profile.is_organizer && <Link href="/admin/camisas" className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-purple-500/10 px-3 text-sm text-purple-200"><ShieldCheck className="h-4 w-4" />Gerenciar todos</Link>}
          </div>
          <ul className="mt-3 divide-y divide-white/10">
            {orders.map((order) => <li key={order.id} className="py-4">
              <div className="flex items-start gap-3">
                <div className="relative h-24 w-20 shrink-0 overflow-hidden rounded-lg bg-black/20">
                  <Image src={shirtModels[order.model].image} alt={shirtModels[order.model].label} fill sizes="80px" className="object-contain" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{shirtModels[order.model].label} · {SHIRT_FITS[order.fit]}</p>
                  <p className="mt-1 text-sm text-white/65">{order.shirt_name.toUpperCase()} · Nº {formatShirtNumber(order.shirt_number)}</p>
                  <p className="text-sm text-white/65">Tamanho {order.size} · Qtd. {order.quantity} · {order.quantity} × {SHIRT_PRICES[order.model].toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>
                  <p className="mt-2 inline-flex rounded-full border border-purple-300/20 bg-purple-500/15 px-2.5 py-1 text-xs font-bold text-purple-100">{shirtOrderStatusLabel(order)}</p>
                  <p className="mt-2 text-xs font-bold text-purple-200">{SHIRT_PAYMENT_LABELS[shirtPayment(order)]}</p>
                </div>
                {!order.paid && !order.half_paid && order.fulfillment_status === "awaiting_payment" && <CancelShirtOrderButton orderId={order.id} model={shirtModels[order.model].label} action={cancelShirtOrder} />}
              </div>
              {canOrder && order.fulfillment_status === "awaiting_payment" && <ActionForm action={updateShirtFit} successMessage="Modelagem atualizada!" className="mt-3 flex flex-wrap items-end gap-2">
                <input type="hidden" name="orderId" value={order.id} />
                <label className="flex-1 text-xs text-white/60">Modelagem
                  <select name="fit" aria-label={"Modelagem da camisa " + shirtModels[order.model].label} required defaultValue={order.fit === "unspecified" ? "" : order.fit} className="mt-1 block min-h-10 w-full rounded-lg border border-white/15 bg-[#21123d] px-2 text-sm text-white">
                    <option value="" disabled>Escolha a modelagem</option><option value="regular">Tradicional</option><option value="female">Feminina</option>
                  </select>
                </label>
                <button type="submit" className="min-h-10 rounded-lg bg-purple-500/20 px-3 text-xs font-bold">Salvar modelagem</button>
              </ActionForm>}
            </li>)}
          </ul>
        </section>
      )}

      {canOrder ? <ShirtOrderForm action={saveShirtOrder} existingOrders={orders} community={community} /> : (
        <section className="rounded-2xl border border-purple-300/15 bg-purple-500/[0.07] p-5 text-center"><Eye className="mx-auto h-7 w-7 text-purple-300" /><h2 className="mt-3 font-bold text-white">Conheça a nova camisa</h2><p className="mx-auto mt-1 max-w-lg text-sm leading-6 text-white/55">Você pode ver toda a coleção. Quando seu acesso completo for liberado, o formulário de pedido aparecerá aqui.</p></section>
      )}
    </div>
  );
}
