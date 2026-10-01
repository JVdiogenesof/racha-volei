import Image from "next/image";
import Link from "next/link";
import { CheckCircle2, Eye, ShieldCheck, Shirt, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { formatShirtNumber, getShirtCollectionImage, getShirtModels, type ShirtModel } from "@/lib/shirts";
import { getActiveCommunity } from "@/lib/community";
import { ShirtOrderForm } from "@/components/ShirtOrderForm";
import { CancelShirtOrderButton } from "@/components/CancelShirtOrderButton";
import { cancelShirtOrder, saveShirtOrder } from "./actions";

type Order = { id: string; model: ShirtModel; shirt_name: string; shirt_number: number; size: string; quantity: number; paid: boolean; created_at: string };

export default async function CamisasPage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const community = await getActiveCommunity(profile);
  const shirtModels = getShirtModels(community);
  const { data } = await supabase.from("shirt_orders").select("id, model, shirt_name, shirt_number, size, quantity, paid, created_at").eq("profile_id", profile.id).eq("community", community).order("created_at");
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
          <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-lg font-bold text-white">Meus pedidos</h2><p className="text-sm text-white/50">Cada modelo aparece como um pedido separado.</p></div>{profile.is_organizer && <Link href="/admin/camisas" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-purple-300/20 bg-purple-500/10 px-3 text-sm font-semibold text-purple-200"><ShieldCheck className="h-4 w-4" />Gerenciar todos</Link>}</div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {orders.map((order) => (
              <article key={order.id} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025]">
                <div className={`relative ${community === "sand" ? "aspect-[4/5] bg-[#191919]" : "aspect-[16/7]"}`}><Image src={shirtModels[order.model].image} alt={`Modelo ${shirtModels[order.model].label}`} fill sizes="(max-width: 640px) 100vw, 50vw" className={community === "sand" ? "object-contain object-center" : "object-cover"} /><span className={`absolute right-3 top-3 rounded-full px-3 py-1 text-xs font-bold backdrop-blur ${order.paid ? "bg-green-500/90 text-white" : "bg-amber-400/90 text-black"}`}>{order.paid ? "Pagamento confirmado" : "Aguardando pagamento"}</span></div>
                <div className="p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-bold text-white">{shirtModels[order.model].label}</p><p className="mt-1 text-sm text-white/55">{order.shirt_name.toUpperCase()} · Nº {formatShirtNumber(order.shirt_number)}</p><p className="mt-1 text-sm text-white/55">Tamanho {order.size} · {order.quantity} {order.quantity === 1 ? "unidade" : "unidades"}</p></div>{!order.paid && <CancelShirtOrderButton orderId={order.id} model={shirtModels[order.model].label} action={cancelShirtOrder} />}</div></div>
              </article>
            ))}
          </div>
        </section>
      )}

      {canOrder ? <ShirtOrderForm action={saveShirtOrder} existingOrders={orders} community={community} /> : (
        <section className="rounded-2xl border border-purple-300/15 bg-purple-500/[0.07] p-5 text-center"><Eye className="mx-auto h-7 w-7 text-purple-300" /><h2 className="mt-3 font-bold text-white">Conheça a nova camisa</h2><p className="mx-auto mt-1 max-w-lg text-sm leading-6 text-white/55">Você pode ver toda a coleção. Quando seu acesso completo for liberado, o formulário de pedido aparecerá aqui.</p></section>
      )}
    </div>
  );
}
