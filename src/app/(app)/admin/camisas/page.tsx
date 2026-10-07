import { createClient } from "@/lib/supabase/server";
import { requireOrganizer } from "@/lib/auth";
import { SHIRT_MODELS, SHIRT_FITS, SHIRT_SIZES, SHIRT_PAYMENT_LABELS, SHIRT_PRICES, shirtPayment, shirtOrderTotal, groupShirtOrders, formatShirtNumber, type ShirtFit, type ShirtModel, type ShirtPayment } from "@/lib/shirts";
import { ShirtPaymentButton } from "@/components/ShirtPaymentButton";
import { ShirtOrderExports, type ExportShirtOrder } from "@/components/ShirtOrderExports";
import { DeleteShirtOrderButton } from "@/components/DeleteShirtOrderButton";
import { EditShirtOrderButton } from "@/components/EditShirtOrderButton";
import { deleteShirtOrder, setShirtOrderPaid, updateShirtOrder } from "./actions";
import { COMMUNITY_INFO, getActiveCommunity } from "@/lib/community";

type OrderRow = {
  id: string; profile_id: string; community: string; model: ShirtModel; fit: ShirtFit;
  shirt_name: string; shirt_number: number; size: string; quantity: number; paid: boolean; half_paid: boolean;
  profiles: { full_name: string; phone: string | null } | null;
};
type ShirtFinanceRow = { id: string; description: string; amount: string | number; transaction_date: string; profile_id: string | null; payment_stage: string; voided_at: string | null; profiles: { full_name: string } | null };

export default async function AdminCamisasPage() {
  const organizer = await requireOrganizer();
  const community = await getActiveCommunity(organizer);
  const supabase = await createClient();
  const [ordersResult, financeResult] = await Promise.all([
    supabase.from("shirt_orders")
      .select("id, profile_id, community, model, fit, shirt_name, shirt_number, size, quantity, paid, half_paid, profiles!shirt_orders_profile_id_fkey(full_name, phone)")
      .eq("community", community).order("created_at"),
    supabase.from("shirt_finance_transactions")
      .select("id, description, amount, transaction_date, profile_id, payment_stage, voided_at, profiles!shirt_finance_transactions_profile_id_fkey(full_name)")
      .eq("community", community).order("transaction_date", { ascending: false }).order("created_at", { ascending: false }),
  ]);
  if (ordersResult.error) throw new Error(ordersResult.error.message);
  if (financeResult.error) throw new Error(financeResult.error.message);
  const orders = (ordersResult.data ?? []) as unknown as OrderRow[];
  const shirtTransactions = (financeResult.data ?? []) as unknown as ShirtFinanceRow[];
  const groups = groupShirtOrders(orders);
  const totalOrdered = orders.reduce((sum, order) => sum + shirtOrderTotal(order), 0);
  const totalReceived = shirtTransactions.filter((transaction) => !transaction.voided_at).reduce((sum, transaction) => sum + Number(transaction.amount), 0);
  const exportOrders: ExportShirtOrder[] = orders.map((o) => ({
    fullName: o.profiles?.full_name ?? "Sem nome", phone: o.profiles?.phone ?? "",
    model: o.model, fit: o.fit, shirtName: o.shirt_name, shirtNumber: o.shirt_number,
    size: o.size, quantity: o.quantity, paid: o.paid, half_paid: o.half_paid,
  }));
  return <div className="space-y-5">
    <div><p className="text-xs font-bold uppercase text-purple-300">Camisas VPA · {COMMUNITY_INFO[community].shortLabel}</p>
      <h1 className="mt-1 text-2xl font-black">Pedidos das camisas</h1>
      <p className="mt-1 text-sm text-white/55">Um pedido por pessoa, com todas as peças juntas. O dinheiro das camisas fica separado do caixa dos rachas.</p>
    </div>
    <div className="flex items-center justify-between gap-3"><div><h2 className="font-black text-white">Caixa das camisas</h2><p className="mt-1 text-xs text-white/45">Valores exclusivos desta coleção.</p></div><span className="rounded-full bg-purple-400/10 px-3 py-1.5 text-[10px] font-black uppercase text-purple-200">Caixa separado</span></div>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {[["Valor dos pedidos", totalOrdered.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })],
        ["Já recebido", totalReceived.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })],
        ["Falta receber", (totalOrdered - totalReceived).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })],
        ["Peças", orders.reduce((sum, o) => sum + o.quantity, 0)]].map(([label, value]) =>
        <div key={label} className="min-w-0 rounded-xl border border-white/10 bg-white/5 p-3"><p className="truncate text-xl font-black sm:text-2xl">{value}</p><p className="text-xs text-white/55">{label}</p></div>)}
    </div>
    <details className="rounded-2xl border border-purple-300/15 bg-purple-500/[0.04] p-4">
      <summary className="cursor-pointer font-bold text-purple-100">Extrato exclusivo das camisas ({shirtTransactions.filter((transaction) => !transaction.voided_at).length})</summary>
      <div className="mt-3 divide-y divide-white/10">{shirtTransactions.length ? shirtTransactions.slice(0, 80).map((transaction) => <div key={transaction.id} className={`flex items-center gap-3 py-3 ${transaction.voided_at ? "opacity-40" : ""}`}><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-white">{transaction.profiles?.full_name ?? "Pessoa não encontrada"}</p><p className="mt-0.5 text-xs text-white/45">{transaction.description} · {new Date(`${transaction.transaction_date}T12:00:00`).toLocaleDateString("pt-BR")}{transaction.voided_at ? " · Estornado" : ""}</p></div><strong className="shrink-0 text-emerald-300">+{Number(transaction.amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</strong></div>) : <p className="py-4 text-center text-sm text-white/40">Nenhum pagamento de camisa registrado.</p>}</div>
    </details>
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
          const groupTotal = group.items.reduce((sum, order) => sum + shirtOrderTotal(order), 0);
          const groupReceived = group.items.reduce((sum, order) => sum + (order.paid ? shirtOrderTotal(order) : order.half_paid ? shirtOrderTotal(order) / 2 : 0), 0);
          return <article key={group.profileId} className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <h3 className="font-bold text-white">{person?.full_name ?? "Sem nome"}</h3>
            <p className="mt-1 text-xs text-white/45">{person?.phone ?? "Telefone não informado"} · {group.items.reduce((n, o) => n + o.quantity, 0)} peças</p>
            <ul className="my-3 divide-y divide-white/10">{group.items.map((order) => <li key={order.id} className="flex items-start gap-3 py-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-purple-200">{SHIRT_MODELS[order.model].label} · {SHIRT_FITS[order.fit]}</p>
                <p className="mt-1 break-words">{order.shirt_name.toUpperCase()} · Nº {formatShirtNumber(order.shirt_number)} · {order.size} · Qtd. {order.quantity}</p>
                <p className="mt-1 text-xs text-white/55">{SHIRT_PAYMENT_LABELS[shirtPayment(order)]} · {order.quantity} × {SHIRT_PRICES[order.model].toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} = {shirtOrderTotal(order).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <EditShirtOrderButton fullName={person?.full_name ?? "Atleta"} order={{ id: order.id, model: order.model, fit: order.fit, shirtName: order.shirt_name, shirtNumber: order.shirt_number, size: order.size, quantity: order.quantity }} action={updateShirtOrder} />
                <DeleteShirtOrderButton orderId={order.id} fullName={person?.full_name ?? "Atleta"} model={SHIRT_MODELS[order.model].label} action={deleteShirtOrder} />
              </div>
            </li>)}</ul>
            <div className="mb-3 grid grid-cols-3 gap-2 rounded-xl bg-black/15 p-3 text-center"><div><p className="text-[9px] font-bold uppercase text-white/35">Total</p><p className="mt-1 text-sm font-black text-white">{groupTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p></div><div><p className="text-[9px] font-bold uppercase text-white/35">Recebido</p><p className="mt-1 text-sm font-black text-emerald-300">{groupReceived.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p></div><div><p className="text-[9px] font-bold uppercase text-white/35">Falta</p><p className="mt-1 text-sm font-black text-amber-200">{(groupTotal - groupReceived).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p></div></div>
            <ShirtPaymentButton profileId={group.profileId} orderIds={group.items.map((o) => o.id)} fullName={person?.full_name ?? "Atleta"} payment={group.payment} action={setShirtOrderPaid} />
          </article>;
        })}</div></section>;
    })}
    {!orders.length && <p className="text-white/55">Nenhum pedido nesta modalidade ainda.</p>}
  </div>;
}
