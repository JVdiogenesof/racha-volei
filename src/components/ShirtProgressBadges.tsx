import { CheckCircle2, PackageCheck } from "lucide-react";
import { SHIRT_PAYMENT_LABELS, groupShirtOrders, type ShirtOrderStatus } from "@/lib/shirts";

export function ShirtProgressBadges({ items }: {
  items: { paid: boolean; half_paid: boolean; fulfillment_status: ShirtOrderStatus }[];
}) {
  if (!items.length) return null;
  const paidCount = items.filter((o) => o.paid).length;
  const deliveredCount = items.filter((o) => o.fulfillment_status === "delivered").length;
  const allPaid = paidCount === items.length;
  const payment = groupShirtOrders(items.map((item) => ({ ...item, profile_id: "", community: "" })))[0].payment;
  const green = "border-emerald-300/25 bg-emerald-400/15 text-emerald-200";
  const muted = "border-amber-300/20 bg-amber-400/10 text-amber-100";
  const badge = "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-bold";
  return <div className="flex flex-wrap gap-1.5">
    <span className={`${badge} ${allPaid ? green : muted}`}>
      {allPaid && <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />}
      {allPaid ? "Pago" : paidCount ? `${paidCount}/${items.length} modelos pagos` : SHIRT_PAYMENT_LABELS[payment]}
    </span>
    {deliveredCount > 0 && <span className={`${badge} ${green}`}>
      <PackageCheck className="h-3.5 w-3.5 shrink-0" />
      {deliveredCount === items.length ? "Entregue" : `${deliveredCount}/${items.length} modelos entregues`}
    </span>}
  </div>;
}
