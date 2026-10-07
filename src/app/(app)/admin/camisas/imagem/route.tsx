import { ImageResponse } from "next/og";
import { createClient } from "@/lib/supabase/server";
import { getShirtModels, shirtOrderStatusLabel, type ShirtOrderStatus, groupShirtOrders, SHIRT_FITS, SHIRT_PAYMENT_LABELS, shirtPayment, type ShirtFit, SHIRT_MODELS, SHIRT_SIZES, formatShirtNumber, type ShirtModel } from "@/lib/shirts";
import { COMMUNITY_INFO, getActiveCommunity } from "@/lib/community";
import { VPA_INSTAGRAM_HANDLE } from "@/lib/brand";

export const dynamic = "force-dynamic";

type PaidOrder = {
  id: string;
  profile_id: string;
  community: string;
  model: ShirtModel;
  fit: ShirtFit;
  paid: boolean;
  half_paid: boolean;
  fulfillment_status: ShirtOrderStatus;
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
  const { data: profile } = await supabase.from("profiles").select("is_organizer, communities").eq("id", user.id).maybeSingle();
  if (!profile?.is_organizer) return new Response("Acesso restrito aos organizadores", { status: 403 });
  const community = await getActiveCommunity(profile);


  const params = new URL(request.url).searchParams;
  const model = params.get("model");
  if (model !== "tank" && model !== "sleeve") return new Response("Escolha Regata ou Com manga para gerar a arte.", { status: 400 });
  const modelLabel = model === "tank" ? "REGATAS" : "COM MANGA";
  const filter = params.get("filter") ?? "received";
  if (!["received", "half", "paid", "all"].includes(filter)) return new Response("Filtro inválido", { status: 400 });
  const filterLabel = filter === "all" ? "TODOS OS PEDIDOS" : filter === "half" ? "METADE PAGA" : filter === "paid" ? "QUITADOS" : "COM ENTRADA OU QUITADOS";
  let query = supabase
    .from("shirt_orders")
    .select("id, profile_id, community, model, fit, paid, half_paid, fulfillment_status, shirt_name, shirt_number, size, quantity, profiles!shirt_orders_profile_id_fkey(full_name)")
    .eq("community", community)
    .eq("model", model)
    .order("paid_at", { ascending: true });
  if (filter === "received") query = query.or("paid.eq.true,half_paid.eq.true");
  if (filter === "half") query = query.eq("half_paid", true);
  if (filter === "paid") query = query.eq("paid", true);
  const { data, error } = await query;
  if (error) return new Response("Não foi possível carregar os pedidos", { status: 500 });
  const orders = (data ?? []) as unknown as PaidOrder[];
  const totalUnits = orders.reduce((sum, order) => sum + order.quantity, 0);
  const groups = groupShirtOrders(orders);
  const displayed = groups;
  const imageHeight = Math.max(1600, 1040 + Math.ceil(groups.length / 2) * 210);
  const collectionUrl = new URL(getShirtModels(community)[model].image.replace(".webp", "-export.jpg"), request.url).toString();
  const logoUrl = new URL("/logo.png", request.url).toString();

  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden", padding: "58px", color: "white", backgroundImage: "radial-gradient(circle at 90% 5%, rgba(196,181,253,.3), transparent 28%), linear-gradient(155deg, #4c1d95 0%, #251044 42%, #10061f 100%)", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoUrl} alt="" width={88} height={88} style={{ borderRadius: "22px" }} />
          <div style={{ display: "flex", flexDirection: "column", marginLeft: "20px" }}><span style={{ color: "#ddd6fe", fontSize: "18px", fontWeight: 800, letterSpacing: "4px" }}>VÔLEI POR AMOR · {COMMUNITY_INFO[community].shortLabel.toUpperCase()}</span><span style={{ marginTop: "4px", fontSize: "44px", fontWeight: 900 }}>{modelLabel} · VPA</span></div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", borderRadius: "22px", background: "#7c3aed", padding: "14px 22px" }}><span style={{ fontSize: "42px", fontWeight: 900, lineHeight: 1 }}>{totalUnits}</span><span style={{ marginTop: "5px", fontSize: "13px", fontWeight: 800, letterSpacing: "2px" }}>PEÇAS</span></div>
      </div>

      <div style={{ display: "flex", flex: 1, flexDirection: "column", justifyContent: "center" }}>
      <div style={{ height: "420px", flexShrink: 0, display: "flex", position: "relative", overflow: "hidden", marginTop: "26px", borderRadius: "28px", border: "2px solid rgba(255,255,255,.14)" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={collectionUrl} alt="" width={964} height={720} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "flex-end", padding: "18px", background: "linear-gradient(to top, rgba(16,6,31,.95), transparent 62%)" }}><span style={{ fontSize: "27px", fontWeight: 900 }}>{filterLabel}</span></div>
      </div>

      <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
        {([model] as ShirtModel[]).map((model) => <div key={model} style={{ flex: 1, display: "flex", flexDirection: "column", padding: "18px", borderRadius: "20px", background: "rgba(255,255,255,.075)", border: "1px solid rgba(255,255,255,.1)" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><span style={{ fontSize: "20px", fontWeight: 800 }}>{SHIRT_MODELS[model].label}</span><span style={{ color: "#c4b5fd", fontSize: "18px", fontWeight: 900 }}>{orders.filter((order) => order.model === model).reduce((sum, order) => sum + order.quantity, 0)} peças</span></div><div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>{SHIRT_SIZES.map((size) => <span key={size} style={{ flex: 1, display: "flex", justifyContent: "center", padding: "7px 3px", borderRadius: "9px", background: "rgba(0,0,0,.18)", fontSize: "13px", fontWeight: 800 }}>{size} {orders.filter((order) => order.model === model && order.size === size).reduce((sum, order) => sum + order.quantity, 0)}</span>)}</div></div>)}
      </div>

      <div style={{ display: "flex", flexDirection: "column", marginTop: "26px" }}>
        <span style={{ color: "#ddd6fe", fontSize: "18px", fontWeight: 800, letterSpacing: "2px" }}>LISTA DE PEDIDOS · {modelLabel}</span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "9px", marginTop: "14px" }}>
          {displayed.map((group, index) => <div key={group.profileId} style={{ width: "49.5%", display: "flex", padding: "18px", minHeight: "180px", borderRadius: "14px", background: "rgba(255,255,255,.065)", border: "1px solid rgba(255,255,255,.09)" }}>
            <span style={{ width: "25px", color: "#a78bfa", fontSize: "12px", fontWeight: 900 }}>{String(index + 1).padStart(2, "0")}</span>
            <div style={{ display: "flex", flex: 1, minWidth: 0, flexDirection: "column" }}>
              <span style={{ fontSize: "21px", fontWeight: 800 }}>{group.items[0].profiles?.full_name ?? "Atleta VPA"}</span>
              {group.items.map((order) => <div key={order.id} style={{ display: "flex", flexDirection: "column", marginTop: "5px", fontSize: "18px", color: "#ddd6fe" }}>
                <span>{SHIRT_MODELS[order.model].label} · {SHIRT_FITS[order.fit]} · {order.size} · Qtd. {order.quantity}</span>
                <span>{order.shirt_name.toUpperCase()} {formatShirtNumber(order.shirt_number)} · {SHIRT_PAYMENT_LABELS[shirtPayment(order)]}</span>
                <span>{shirtOrderStatusLabel(order)}</span>
              </div>)}
            </div>
          </div>)}

        </div>
        {groups.length > displayed.length && <span style={{ marginTop: "12px", alignSelf: "center", color: "#ddd6fe", fontSize: "14px" }}>+{groups.length - displayed.length} pessoas na lista completa</span>}
      </div>

      </div>
      <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "20px", borderTop: "1px solid rgba(255,255,255,.12)", color: "rgba(255,255,255,.58)", fontSize: "15px", letterSpacing: "1px" }}><span>NOSSA CAMISA. NOSSA HISTÓRIA.</span><span>{VPA_INSTAGRAM_HANDLE}</span></div>
    </div>,
    { width: 1080, height: imageHeight, headers: { "Cache-Control": "private, no-store", "Content-Disposition": `inline; filename="pedidos-vpa-${community}-${model === "tank" ? "regatas" : "com-manga"}-${filter}.png"` } },
  );
}
