import { canAccessShirts } from "@/lib/shirt-access";
import { ImageResponse } from "next/og";
import { createClient } from "@/lib/supabase/server";
import { SHIRT_MODELS, SHIRT_SIZES, formatShirtNumber, type ShirtModel } from "@/lib/shirts";

export const dynamic = "force-dynamic";

type PaidOrder = {
  id: string;
  model: ShirtModel;
  shirt_name: string;
  shirt_number: number;
  size: string;
  quantity: number;
  profiles: { full_name: string } | null;
};

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Não autorizado", { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("is_organizer").eq("id", user.id).maybeSingle();
  if (!profile?.is_organizer || !canAccessShirts(user.id)) return new Response("Acesso restrito durante o pré-lançamento", { status: 403 });

  const { data, error } = await supabase
    .from("shirt_orders")
    .select("id, model, shirt_name, shirt_number, size, quantity, profiles!shirt_orders_profile_id_fkey(full_name)")
    .eq("paid", true)
    .order("paid_at", { ascending: true });
  if (error) return new Response("Não foi possível carregar os pedidos", { status: 500 });
  const orders = (data ?? []) as unknown as PaidOrder[];
  const totalUnits = orders.reduce((sum, order) => sum + order.quantity, 0);
  const displayed = orders.slice(0, 28);
  const collectionUrl = new URL("/camisas/colecao-vpa-v2.jpg", request.url).toString();
  const logoUrl = new URL("/logo.png", request.url).toString();

  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden", padding: "58px", color: "white", backgroundImage: "radial-gradient(circle at 90% 5%, rgba(196,181,253,.3), transparent 28%), linear-gradient(155deg, #4c1d95 0%, #251044 42%, #10061f 100%)", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoUrl} alt="" width={88} height={88} style={{ borderRadius: "22px" }} />
          <div style={{ display: "flex", flexDirection: "column", marginLeft: "20px" }}><span style={{ color: "#ddd6fe", fontSize: "18px", fontWeight: 800, letterSpacing: "4px" }}>VÔLEI POR AMOR</span><span style={{ marginTop: "4px", fontSize: "44px", fontWeight: 900 }}>NOVA PELE VPA</span></div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", borderRadius: "22px", background: "#7c3aed", padding: "14px 22px" }}><span style={{ fontSize: "42px", fontWeight: 900, lineHeight: 1 }}>{totalUnits}</span><span style={{ marginTop: "5px", fontSize: "13px", fontWeight: 800, letterSpacing: "2px" }}>CAMISAS PAGAS</span></div>
      </div>

      <div style={{ height: "360px", display: "flex", position: "relative", overflow: "hidden", marginTop: "32px", borderRadius: "28px", border: "2px solid rgba(255,255,255,.14)" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={collectionUrl} alt="" width={964} height={720} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "flex-end", padding: "26px", background: "linear-gradient(to top, rgba(16,6,31,.95), transparent 62%)" }}><span style={{ fontSize: "27px", fontWeight: 900 }}>PEDIDOS CONFIRMADOS</span></div>
      </div>

      <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
        {(["tank", "sleeve"] as ShirtModel[]).map((model) => <div key={model} style={{ flex: 1, display: "flex", flexDirection: "column", padding: "18px", borderRadius: "20px", background: "rgba(255,255,255,.075)", border: "1px solid rgba(255,255,255,.1)" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><span style={{ fontSize: "20px", fontWeight: 800 }}>{SHIRT_MODELS[model].label}</span><span style={{ color: "#c4b5fd", fontSize: "18px", fontWeight: 900 }}>{orders.filter((order) => order.model === model).reduce((sum, order) => sum + order.quantity, 0)} peças</span></div><div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>{SHIRT_SIZES.map((size) => <span key={size} style={{ flex: 1, display: "flex", justifyContent: "center", padding: "7px 3px", borderRadius: "9px", background: "rgba(0,0,0,.18)", fontSize: "13px", fontWeight: 800 }}>{size} {orders.filter((order) => order.model === model && order.size === size).reduce((sum, order) => sum + order.quantity, 0)}</span>)}</div></div>)}
      </div>

      <div style={{ display: "flex", flexDirection: "column", marginTop: "26px" }}>
        <span style={{ color: "#ddd6fe", fontSize: "18px", fontWeight: 800, letterSpacing: "2px" }}>QUEM JÁ GARANTIU</span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "9px", marginTop: "14px" }}>
          {displayed.map((order, index) => <div key={order.id} style={{ width: "49.5%", display: "flex", alignItems: "center", padding: "10px 13px", borderRadius: "14px", background: "rgba(255,255,255,.065)", border: "1px solid rgba(255,255,255,.09)" }}><span style={{ width: "28px", color: "#a78bfa", fontSize: "12px", fontWeight: 900 }}>{String(index + 1).padStart(2, "0")}</span><div style={{ minWidth: 0, display: "flex", flex: 1, flexDirection: "column" }}><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "15px", fontWeight: 800 }}>{order.profiles?.full_name ?? "Atleta VPA"}</span><span style={{ marginTop: "2px", color: "rgba(255,255,255,.58)", fontSize: "11px" }}>{SHIRT_MODELS[order.model].label} · {order.shirt_name.toUpperCase()} {formatShirtNumber(order.shirt_number)} · {order.size} · Qtd. {order.quantity}</span></div></div>)}
        </div>
        {orders.length > displayed.length && <span style={{ marginTop: "12px", alignSelf: "center", color: "#ddd6fe", fontSize: "14px" }}>+{orders.length - displayed.length} pedidos na lista completa</span>}
      </div>

      <div style={{ display: "flex", flex: 1 }} />
      <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "20px", borderTop: "1px solid rgba(255,255,255,.12)", color: "rgba(255,255,255,.58)", fontSize: "15px", letterSpacing: "1px" }}><span>NOSSA CAMISA. NOSSA HISTÓRIA.</span><span>@volei_por_amor</span></div>
    </div>,
    { width: 1080, height: 1920, headers: { "Cache-Control": "private, no-store", "Content-Disposition": 'inline; filename="pedidos-pagos-camisas-vpa.png"' } },
  );
}
