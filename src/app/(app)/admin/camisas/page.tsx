import { CheckCircle2, Clock3, PackageCheck, Shirt } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireOrganizer } from "@/lib/auth";
import { SHIRT_MODELS, SHIRT_SIZES, formatShirtNumber, type ShirtModel } from "@/lib/shirts";
import { ShirtPaymentButton } from "@/components/ShirtPaymentButton";
import { ShirtOrderExports, type ExportShirtOrder } from "@/components/ShirtOrderExports";
import { setShirtOrderPaid } from "./actions";
import { COMMUNITY_INFO, getActiveCommunity } from "@/lib/community";

type OrderRow = {
  id: string; model: ShirtModel; shirt_name: string; shirt_number: number; size: string; quantity: number; paid: boolean; paid_at: string | null; created_at: string;
  profiles: { full_name: string; phone: string | null } | null;
};

export default async function AdminCamisasPage() {
  const organizer = await requireOrganizer();
  const supabase = await createClient();
  const community = await getActiveCommunity(organizer);
  const { data, error } = await supabase
    .from("shirt_orders")
    .select("id, model, shirt_name, shirt_number, size, quantity, paid, paid_at, created_at, profiles!shirt_orders_profile_id_fkey(full_name, phone)")
    .eq("community", community)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  const orders = (data ?? []) as unknown as OrderRow[];
  const pendingOrders = orders.filter((order) => !order.paid);
  const paidOrders = orders.filter((order) => order.paid);
  const totalUnits = orders.reduce((sum, order) => sum + order.quantity, 0);
  const exportOrders: ExportShirtOrder[] = orders.map((order) => ({ fullName: order.profiles?.full_name ?? "Sem nome", phone: order.profiles?.phone ?? "", model: order.model, shirtName: order.shirt_name, shirtNumber: order.shirt_number, size: order.size, quantity: order.quantity, paid: order.paid }));

  return (
    <div className="space-y-6">
      <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-purple-300">Nova coleção VPA · {COMMUNITY_INFO[community].shortLabel}</p><h1 className="mt-1 flex items-center gap-2 text-2xl font-black text-white"><Shirt className="h-6 w-6 text-purple-300" />Pedidos das camisas</h1><p className="mt-1 text-sm text-white/55">Lista exclusiva do {COMMUNITY_INFO[community].label.toLowerCase()}. Pagamentos e exportações ficam separados da outra modalidade.</p></div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Summary label="Pedidos" value={orders.length} icon={Shirt} />
        <Summary label="Peças" value={totalUnits} icon={PackageCheck} />
        <Summary label="Aguardando" value={pendingOrders.length} icon={Clock3} tone="amber" />
        <Summary label="Pagos" value={paidOrders.length} icon={CheckCircle2} tone="green" />
      </div>

      <section className="rounded-2xl border border-white/10 p-4 sm:p-5"><h2 className="font-bold text-white">Resumo para produção</h2><div className="mt-4 grid gap-3 sm:grid-cols-2">{(["tank", "sleeve"] as ShirtModel[]).map((model) => <div key={model} className="rounded-xl bg-white/[0.035] p-4"><div className="flex items-center justify-between"><p className="font-bold text-white">{SHIRT_MODELS[model].label}</p><span className="text-sm font-bold text-purple-300">{orders.filter((order) => order.model === model).reduce((sum, order) => sum + order.quantity, 0)} peças</span></div><div className="mt-3 grid grid-cols-5 gap-1.5">{SHIRT_SIZES.map((size) => <div key={size} className="rounded-lg border border-white/8 py-2 text-center"><p className="text-[10px] font-bold text-white/40">{size}</p><p className="text-sm font-black text-white">{orders.filter((order) => order.model === model && order.size === size).reduce((sum, order) => sum + order.quantity, 0)}</p></div>)}</div></div>)}</div></section>

      {orders.length > 0 && <ShirtOrderExports orders={exportOrders} community={community} />}
      <OrderSection title="Aguardando pagamento" description="Pedidos que ainda precisam ser conferidos." orders={pendingOrders} empty="Nenhum pagamento pendente." />
      <OrderSection title="Pagos" description="Lista separada dos pedidos já confirmados." orders={paidOrders} empty="Nenhum pagamento confirmado ainda." paid />
    </div>
  );
}

function Summary({ label, value, icon: Icon, tone = "purple" }: { label: string; value: number; icon: typeof Shirt; tone?: "purple" | "amber" | "green" }) {
  const color = tone === "green" ? "text-green-300 bg-green-500/15" : tone === "amber" ? "text-amber-300 bg-amber-500/15" : "text-purple-300 bg-purple-500/15";
  return <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 sm:p-4"><span className={`flex h-9 w-9 items-center justify-center rounded-xl ${color}`}><Icon className="h-4 w-4" /></span><p className="mt-3 text-2xl font-black text-white">{value}</p><p className="text-xs text-white/45">{label}</p></div>;
}

function OrderSection({ title, description, orders, empty, paid = false }: { title: string; description: string; orders: OrderRow[]; empty: string; paid?: boolean }) {
  return <section className={`rounded-2xl border p-4 sm:p-5 ${paid ? "border-green-400/15 bg-green-500/[0.035]" : "border-amber-300/15 bg-amber-500/[0.025]"}`}><div className="flex items-center gap-2"><span className={`flex h-9 w-9 items-center justify-center rounded-xl ${paid ? "bg-green-500/15 text-green-300" : "bg-amber-500/15 text-amber-300"}`}>{paid ? <CheckCircle2 className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}</span><div><h2 className="font-bold text-white">{title} <span className="text-white/35">({orders.length})</span></h2><p className="text-xs text-white/45">{description}</p></div></div><div className="mt-4 grid gap-3 lg:grid-cols-2">{orders.map((order) => { const fullName = order.profiles?.full_name ?? "Sem nome"; return <article key={order.id} className="rounded-xl border border-white/10 bg-black/10 p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-bold text-white">{fullName}</p><p className="mt-0.5 text-xs text-white/40">{order.profiles?.phone ?? "Telefone não informado"}</p></div><span className="shrink-0 rounded-full bg-purple-500/15 px-2.5 py-1 text-xs font-bold text-purple-200">{SHIRT_MODELS[order.model].label}</span></div><div className="mt-3 grid grid-cols-4 gap-2 text-center"><Datum label="Nome" value={order.shirt_name.toUpperCase()} /><Datum label="Número" value={formatShirtNumber(order.shirt_number)} /><Datum label="Tam." value={order.size} /><Datum label="Qtd." value={order.quantity} /></div><div className="mt-3 flex justify-end"><ShirtPaymentButton orderId={order.id} fullName={fullName} paid={order.paid} action={setShirtOrderPaid} /></div></article>; })}{!orders.length && <p className="text-sm text-white/45">{empty}</p>}</div></section>;
}

function Datum({ label, value }: { label: string; value: string | number }) { return <div className="min-w-0 rounded-lg bg-white/[0.04] px-1.5 py-2"><p className="text-[9px] font-bold uppercase text-white/35">{label}</p><p className="mt-0.5 truncate text-sm font-bold text-white">{value}</p></div>; }
