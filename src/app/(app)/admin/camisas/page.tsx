import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, ChevronDown, Clock, CircleDollarSign, Package, PackageCheck, Shirt, FileDown, Wallet, Ruler, Users, Search } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { ShirtProgressBadges } from "@/components/ShirtProgressBadges";
import { ShirtOrderStatusControl } from "@/components/ShirtOrderStatusControl";
import { shirtGroupMatchesView, type ShirtListView, type ShirtOrderStatus } from "@/lib/shirts";
import { requireOrganizer } from "@/lib/auth";
import { SHIRT_MODELS, SHIRT_FITS, SHIRT_SIZES, SHIRT_PAYMENT_LABELS, SHIRT_PRICES, shirtPayment, shirtOrderTotal, groupShirtOrders, formatShirtNumber, type ShirtFit, type ShirtModel } from "@/lib/shirts";
import { ShirtPaymentButton } from "@/components/ShirtPaymentButton";
import { ShirtOrderExports, type ExportShirtOrder } from "@/components/ShirtOrderExports";
import { DeleteShirtOrderButton } from "@/components/DeleteShirtOrderButton";
import { EditShirtOrderButton } from "@/components/EditShirtOrderButton";
import { deleteShirtOrder, setShirtOrderPaid, updateShirtOrder, setShirtOrderStatus } from "./actions";
import { COMMUNITY_INFO, getActiveCommunity } from "@/lib/community";

type OrderRow = {
  fulfillment_status: ShirtOrderStatus;
  id: string; profile_id: string; community: string; model: ShirtModel; fit: ShirtFit;
  shirt_name: string; shirt_number: number; size: string; quantity: number; paid: boolean; half_paid: boolean;
  profiles: { full_name: string; phone: string | null; avatar_url: string | null } | null;
};
type ShirtFinanceRow = { id: string; description: string; amount: string | number; transaction_date: string; profile_id: string | null; payment_stage: string; voided_at: string | null; profiles: { full_name: string } | null };


const LIST_VIEWS = {
  pending: { label: "Pendentes", description: "Sem pagamento registrado", icon: Clock },
  partial: { label: "Parciais", description: "Metade paga ou pagamento misto", icon: CircleDollarSign },
  paid: { label: "Pagos", description: "Todas as peças quitadas", icon: CheckCircle2 },
  ordered: { label: "Na loja", description: "Pedidos enviados à loja", icon: Package },
  delivered: { label: "Entregues", description: "Com peças já entregues", icon: PackageCheck },
  all: { label: "Todos", description: "Todos os pedidos", icon: Users },
} as const;
const TOOLS = {
  exports: { label: "Exportar", description: "Artes e listas por modelo", icon: FileDown },
  finance: { label: "Caixa", description: "Valores e extrato", icon: Wallet },
  production: { label: "Produção", description: "Quantidades por tamanho", icon: Ruler },
} as const;
type View = ShirtListView | keyof typeof TOOLS | "home";
const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default async function AdminCamisasPage({ searchParams }: { searchParams: Promise<{ view?: string; status?: string; q?: string }> }) {
  const params = await searchParams;
  const legacy = params.status === "ordered" || params.status === "delivered" ? params.status : params.status === "awaiting_payment" ? "all" : "home";
  const requested = params.view ?? legacy;
  const view: View = Object.hasOwn(LIST_VIEWS, requested) || Object.hasOwn(TOOLS, requested) ? requested as View : "home";
  const listView = Object.hasOwn(LIST_VIEWS, view) ? view as ShirtListView : null;
  const organizer = await requireOrganizer();
  const community = await getActiveCommunity(organizer);
  const supabase = await createClient();
  const [ordersResult, financeResult] = await Promise.all([
    supabase.from("shirt_orders")
      .select("id, profile_id, community, model, fit, shirt_name, shirt_number, size, quantity, paid, half_paid, fulfillment_status, profiles!shirt_orders_profile_id_fkey(full_name, phone, avatar_url)")
      .eq("community", community).order("created_at"),
    view === "finance" ? supabase.from("shirt_finance_transactions")
      .select("id, description, amount, transaction_date, profile_id, payment_stage, voided_at, profiles!shirt_finance_transactions_profile_id_fkey(full_name)")
      .eq("community", community).order("transaction_date", { ascending: false }).order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (ordersResult.error) throw new Error(ordersResult.error.message);
  if (financeResult.error) throw new Error(financeResult.error.message);
  const orders = (ordersResult.data ?? []) as unknown as OrderRow[];
  const shirtTransactions = (financeResult.data ?? []) as unknown as ShirtFinanceRow[];
  const groups = groupShirtOrders(orders);
  const totalOrdered = orders.reduce((sum, order) => sum + shirtOrderTotal(order), 0);
  const totalReceived = shirtTransactions.filter((transaction) => !transaction.voided_at).reduce((sum, transaction) => sum + Number(transaction.amount), 0);
  const query = (params.q ?? "").trim().toLocaleLowerCase("pt-BR");
  const paymentPriority = { paid: 0, half: 1, mixed: 1, pending: 2 } as const;
  const selected = listView ? groups.filter((g) => shirtGroupMatchesView(g, listView) &&
    (!query || g.items.some((o) => (o.profiles?.full_name ?? "").toLocaleLowerCase("pt-BR").includes(query) || o.shirt_name.toLocaleLowerCase("pt-BR").includes(query))))
    .sort((first, second) => paymentPriority[first.payment] - paymentPriority[second.payment]) : [];
  const exportOrders: ExportShirtOrder[] = view === "exports" ? orders.map((o) => ({
    fullName: o.profiles?.full_name ?? "Sem nome", phone: o.profiles?.phone ?? "",
    model: o.model, fit: o.fit, shirtName: o.shirt_name, shirtNumber: o.shirt_number,
    size: o.size, quantity: o.quantity, paid: o.paid, half_paid: o.half_paid,
    fulfillment_status: o.fulfillment_status,
  })) : [];
  const title = listView ? LIST_VIEWS[listView].label : view === "home" ? "Camisas" : TOOLS[view as keyof typeof TOOLS].label;
  return <div className="space-y-4">
    <header>
      {view !== "home" && <Link href="/admin/camisas" className="mb-3 inline-flex min-h-10 items-center gap-2 text-sm text-purple-200"><ArrowLeft className="h-4 w-4" />Voltar às camisas</Link>}
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-500/15 text-purple-200"><Shirt className="h-5 w-5" /></span>
        <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-widest text-purple-300">Camisas VPA · {COMMUNITY_INFO[community].shortLabel}</p>
          <h1 className="text-2xl font-black">{title}</h1></div>
      </div>
      <p className="mt-2 text-xs text-white/50">{view === "home" ? `${groups.length} pessoas · ${orders.reduce((sum, o) => sum + o.quantity, 0)} peças. Escolha o que deseja consultar.` : listView ? LIST_VIEWS[listView].description + ". Toque na pessoa para ver e gerenciar o pedido." : TOOLS[view as keyof typeof TOOLS].description}</p>
    </header>

    {view === "home" && <nav aria-label="Áreas das camisas" className="grid grid-cols-3 gap-2 sm:gap-3">
      {(Object.entries(LIST_VIEWS) as [ShirtListView, typeof LIST_VIEWS[ShirtListView]][]).map(([key, config]) => {
        const Icon = config.icon;
        const count = groups.filter((g) => shirtGroupMatchesView(g, key)).length;
        const green = key === "paid" || key === "delivered";
        return <Link key={key} href={`/admin/camisas?view=${key}`} className={`flex min-h-28 min-w-0 flex-col items-center justify-center gap-1 rounded-2xl border p-2 text-center transition hover:bg-white/10 ${green ? "border-emerald-300/20 bg-emerald-500/[0.08] text-emerald-200" : "border-white/10 bg-white/[0.035] text-purple-200"}`}>
          <Icon className="h-6 w-6" /><span className="text-xl font-black">{count}</span><span className="text-xs font-semibold">{config.label}</span>
        </Link>;
      })}
      {Object.entries(TOOLS).map(([key, config]) => <Link key={key} href={`/admin/camisas?view=${key}`} className="flex min-h-24 min-w-0 flex-col items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.035] p-2 text-center text-purple-200 hover:bg-white/10"><config.icon className="h-6 w-6" /><span className="text-xs font-semibold">{config.label}</span></Link>)}
    </nav>}

    {view === "finance" && <section className="space-y-4">
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

    </section>}
    {view === "production" && <section>
    <details open className="rounded-2xl border border-white/10 p-4">
      <summary className="cursor-pointer font-bold">Resumo para produção</summary>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">{(["tank", "sleeve"] as ShirtModel[]).flatMap((model) =>
        (Object.keys(SHIRT_FITS) as ShirtFit[]).map((fit) => {
          const items = orders.filter((o) => o.model === model && o.fit === fit);
          if (!items.length) return null;
          return <div key={model + fit} className="rounded-xl bg-white/5 p-3"><p className="font-bold">{SHIRT_MODELS[model].label} · {SHIRT_FITS[fit]}</p>
            <div className="mt-2 flex flex-wrap gap-3">{SHIRT_SIZES.map((size) => <span key={size} className="text-sm text-white/65">{size}: {items.filter((o) => o.size === size).reduce((n, o) => n + o.quantity, 0)}</span>)}</div></div>;
        }))}</div>
    </details>

    </section>}
    {view === "exports" && <ShirtOrderExports orders={exportOrders} community={community} />}
    {listView && <section className="space-y-3">
      <form action="/admin/camisas" className="flex gap-2">
        <input type="hidden" name="view" value={listView} />
        <label className="min-w-0 flex-1"><span className="sr-only">Buscar pessoa ou nome na camisa</span><input type="search" name="q" defaultValue={params.q ?? ""} placeholder="Buscar pessoa..." className="field" /></label>
        <button type="submit" aria-label="Buscar pedido" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/5"><Search className="h-4 w-4" /></button>
      </form>
      <p className="text-xs text-white/45">{selected.length} {selected.length === 1 ? "pessoa" : "pessoas"} · Peças da mesma pessoa ficam juntas.</p>
      <div className="grid items-start gap-2 lg:grid-cols-2">{selected.map((group) => {
          const person = group.items[0].profiles;
          const groupTotal = group.items.reduce((sum, order) => sum + shirtOrderTotal(order), 0);
          const groupReceived = group.items.reduce((sum, order) => sum + (order.paid ? shirtOrderTotal(order) : order.half_paid ? shirtOrderTotal(order) / 2 : 0), 0);

          const allDelivered = group.items.every((o) => o.fulfillment_status === "delivered");
          return <details key={group.profileId} className={`group min-w-0 self-start overflow-hidden rounded-2xl border ${group.payment === "paid" || allDelivered ? "border-emerald-300/25 bg-emerald-500/[0.06]" : "border-white/10 bg-white/[0.035]"}`}>
            <summary className="flex cursor-pointer list-none items-center gap-3 p-3 [&::-webkit-details-marker]:hidden">
              <Avatar src={person?.avatar_url} name={person?.full_name ?? "Atleta"} />
              <div className="min-w-0 flex-1">
                <h3 className="break-words text-sm font-bold text-white">{person?.full_name ?? "Sem nome"}</h3>
                <p className="mb-2 mt-0.5 text-xs text-white/45">{group.items.reduce((n, o) => n + o.quantity, 0)} peças · {money(groupTotal)}</p>
                <ShirtProgressBadges items={group.items} />
              </div>
              <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-white/45 transition group-open:rotate-180" />
            </summary>
            <div className="border-t border-white/10 px-3 pb-3">

            <p className="mt-1 text-xs text-white/45">{person?.phone ?? "Telefone não informado"} · {group.items.reduce((n, o) => n + o.quantity, 0)} peças</p>
            <ul className="my-3 divide-y divide-white/10">{group.items.map((order) => <li key={order.id} className="space-y-2 py-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-purple-200">{SHIRT_MODELS[order.model].label} · {SHIRT_FITS[order.fit]}</p>
                <p className="mt-1 break-words">{order.shirt_name.toUpperCase()} · Nº {formatShirtNumber(order.shirt_number)} · {order.size} · Qtd. {order.quantity}</p>
                <p className="mt-1 text-xs text-white/55">{SHIRT_PAYMENT_LABELS[shirtPayment(order)]} · {order.quantity} × {SHIRT_PRICES[order.model].toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} = {shirtOrderTotal(order).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>
                <div className="mt-2"><ShirtProgressBadges items={[order]} /></div>
                <ShirtOrderStatusControl orderId={order.id} status={order.fulfillment_status} hasPayment={order.paid || order.half_paid} label={`${person?.full_name ?? "Atleta"} · ${SHIRT_MODELS[order.model].label}`} action={setShirtOrderStatus} />
              </div>
              <div className="flex items-center justify-end gap-2">
                <EditShirtOrderButton fullName={person?.full_name ?? "Atleta"} order={{ id: order.id, model: order.model, fit: order.fit, shirtName: order.shirt_name, shirtNumber: order.shirt_number, size: order.size, quantity: order.quantity }} action={updateShirtOrder} />
                <DeleteShirtOrderButton orderId={order.id} fullName={person?.full_name ?? "Atleta"} model={SHIRT_MODELS[order.model].label} action={deleteShirtOrder} />
              </div>
            </li>)}</ul>
            <div className="mb-3 grid grid-cols-3 gap-2 rounded-xl bg-black/15 p-3 text-center"><div><p className="text-[9px] font-bold uppercase text-white/35">Total</p><p className="mt-1 text-sm font-black text-white">{groupTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p></div><div><p className="text-[9px] font-bold uppercase text-white/35">Recebido</p><p className="mt-1 text-sm font-black text-emerald-300">{groupReceived.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p></div><div><p className="text-[9px] font-bold uppercase text-white/35">Falta</p><p className="mt-1 text-sm font-black text-amber-200">{(groupTotal - groupReceived).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p></div></div>
            <ShirtPaymentButton profileId={group.profileId} orderIds={group.items.map((o) => o.id)} fullName={person?.full_name ?? "Atleta"} payment={group.payment} action={setShirtOrderPaid} />
            </div>
          </details>;

      })}</div>
      {!selected.length && <p className="rounded-2xl border border-dashed border-white/15 p-6 text-center text-sm text-white/50">Nenhum pedido nesta lista{query ? " com esse nome" : ""}.</p>}
    </section>}
  </div>;
}
