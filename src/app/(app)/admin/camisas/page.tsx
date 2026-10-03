import { createClient } from "@/lib/supabase/server";
import { requireOrganizer } from "@/lib/auth";
import { SHIRT_MODELS, SHIRT_FITS, SHIRT_SIZES, SHIRT_PAYMENT_LABELS, shirtPayment, groupShirtOrders, formatShirtNumber, type ShirtFit, type ShirtModel, type ShirtPayment } from "@/lib/shirts";
import { ShirtPaymentButton } from "@/components/ShirtPaymentButton";
import { ShirtOrderExports, type ExportShirtOrder } from "@/components/ShirtOrderExports";
import { DeleteShirtOrderButton } from "@/components/DeleteShirtOrderButton";
import { deleteShirtOrder, setShirtOrderPaid } from "./actions";
import { COMMUNITY_INFO, getActiveCommunity } from "@/lib/community";

type OrderRow = {
  id: string; profile_id: string; community: string; model: ShirtModel; fit: ShirtFit;
  shirt_name: string; shirt_number: number; size: string; quantity: number; paid: boolean; half_paid: boolean;
  profiles: { full_name: string; phone: string | null } | null;
};

export default async function AdminCamisasPage() {
  const organizer = await requireOrganizer();
  const community = await getActiveCommunity(organizer);
  const supabase = await createClient();
  const { data, error } = await supabase.from("shirt_orders")
    .select("id, profile_id, community, model, fit, shirt_name, shirt_number, size, quantity, paid, half_paid, profiles!shirt_orders_profile_id_fkey(full_name, phone)")
    .eq("community", community).order("created_at");
  if (error) throw new Error(error.message);
  const orders = (data ?? []) as unknown as OrderRow[];
  const groups = groupShirtOrders(orders);
  const exportOrders: ExportShirtOrder[] = orders.map((o) => ({
    fullName: o.profiles?.full_name ?? "Sem nome", phone: o.profiles?.phone ?? "",
    model: o.model, fit: o.fit, shirtName: o.shirt_name, shirtNumber: o.shirt_number,
    size: o.size, quantity: o.quantity, paid: o.paid, half_paid: o.half_paid,
  }));
  return <div className="space-y-5">
    <div><p className="text-xs font-bold uppercase text-purple-300">Camisas VPA · {COMMUNITY_INFO[community].shortLabel}</p>
      <h1 className="mt-1 text-2xl font-black">Pedidos das camisas</h1>
      <p className="mt-1 text-sm text-white/55">Um pedido por pessoa, com todas as peças juntas. Os pagamentos abaixo se aplicam às peças exibidas no card.</p>
    </div>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {[["Pessoas", groups.length], ["Peças", orders.reduce((sum, o) => sum + o.quantity, 0)],
        ["Com entrada / parcial", groups.filter((g) => g.payment === "half" || g.payment === "mixed").length],
        ["Quitados", groups.filter((g) => g.payment === "paid").length]].map(([label, value]) =>
        <div key={label} className="rounded-xl border border-white/10 bg-white/5 p-3"><p className="text-2xl font-black">{value}</p><p className="text-xs text-white/55">{label}</p></div>)}
    </div>
    <details className="rounded-2xl border border-white/10 p-4">
      <summary className="cursor-pointer font-bold">Resumo para produção</summary>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">{(["tank", "sleeve"] as ShirtModel[]).flatMap((model) =>
        (Object.keys(SHIRT_FITS) as ShirtFit[]).map((fit) => {
          const items = orders.filter((o) => o.model === model && o.fit === fit);
          if (!items.length) return null;
          return <div key={model + fit} className="rounded-xl bg-white/5 p-3"><p className="font-bold">{SHIRT_MODELS[model].label} · {SHIRT_FITS[fit]}</p>
            <div className="mt-2 flex flex-wrap gap-3">{SHIRT_SIZES.map((size) => <span key={size} className="text-sm text-white/65">{size}: {items.filter((o) => o.size === size).reduce((n, o) => n + o.quantity, 0)}</span>)}</div></div>;
        }))}</div>
    </details>
    {!!orders.length && <ShirtOrderExports orders={exportOrders} community={community} />}
    {(["pending", "half", "mixed", "paid"] as ShirtPayment[]).map((payment) => {
      const selected = groups.filter((g) => g.payment === payment);
      if (!selected.length) return null;
      return <section key={payment}><h2 className="mb-3 font-bold">{SHIRT_PAYMENT_LABELS[payment]} ({selected.length})</h2>
        <div className="grid gap-3 lg:grid-cols-2">{selected.map((group) => {
          const person = group.items[0].profiles;
          return <article key={group.profileId} className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <h3 className="font-bold text-white">{person?.full_name ?? "Sem nome"}</h3>
            <p className="mt-1 text-xs text-white/45">{person?.phone ?? "Telefone não informado"} · {group.items.reduce((n, o) => n + o.quantity, 0)} peças</p>
            <ul className="my-3 divide-y divide-white/10">{group.items.map((order) => <li key={order.id} className="flex items-start gap-3 py-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-purple-200">{SHIRT_MODELS[order.model].label} · {SHIRT_FITS[order.fit]}</p>
                <p className="mt-1 break-words">{order.shirt_name.toUpperCase()} · Nº {formatShirtNumber(order.shirt_number)} · {order.size} · Qtd. {order.quantity}</p>
                <p className="mt-1 text-xs text-white/55">{SHIRT_PAYMENT_LABELS[shirtPayment(order)]}</p>
              </div>
              <DeleteShirtOrderButton orderId={order.id} fullName={person?.full_name ?? "Atleta"} model={SHIRT_MODELS[order.model].label} action={deleteShirtOrder} />
            </li>)}</ul>
            <ShirtPaymentButton profileId={group.profileId} orderIds={group.items.map((o) => o.id)} fullName={person?.full_name ?? "Atleta"} payment={group.payment} action={setShirtOrderPaid} />
          </article>;
        })}</div></section>;
    })}
    {!orders.length && <p className="text-white/55">Nenhum pedido nesta modalidade ainda.</p>}
  </div>;
}
