import { ImageResponse } from "next/og";
import { createClient } from "@/lib/supabase/server";
import { formatQueridometroWeek, normalizeQueridometroResults, type QueridometroType } from "@/lib/queridometro";

export const dynamic = "force-dynamic";

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Não autorizado", { status: 401 });

  const weekStart = new URL(request.url).searchParams.get("week");
  if (!weekStart || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) return new Response("Semana inválida", { status: 400 });

  const [
    { data: profile },
    { data: typeRows },
    { data: resultData, error: resultError },
    { data: connectionData },
    { data: profileRows },
  ] = await Promise.all([
    supabase.from("profiles").select("id, full_name, avatar_url").eq("id", user.id).maybeSingle(),
    supabase.from("queridometro_reaction_types").select("key, emoji, label, description, connection_label, active, sort_order").order("sort_order"),
    supabase.rpc("get_queridometro_results", { p_week_start: weekStart }),
    supabase.rpc("get_my_queridometro_connections", { p_week_start: weekStart }),
    supabase.from("profiles").select("id, full_name"),
  ]);
  if (!profile) return new Response("Perfil não encontrado", { status: 404 });
  if (resultError) return new Response("Não foi possível carregar o resultado", { status: 500 });

  const types = (typeRows ?? []) as QueridometroType[];
  const typeByKey = new Map(types.map((type) => [type.key, type]));
  const results = normalizeQueridometroResults(resultData);
  const myResults = results
    .filter((row) => row.to_profile_id === user.id)
    .flatMap((row) => {
      const type = typeByKey.get(row.reaction_key);
      return type ? [{ ...type, total: row.total }] : [];
    })
    .sort((a, b) => b.total - a.total);
  if (!myResults.length) return new Response("Seu resultado ainda não está disponível", { status: 409 });

  const names = new Map((profileRows ?? []).map((item) => [item.id, item.full_name]));
  const connections = ((connectionData ?? []) as { other_profile_id: string; reaction_key: string; connection_label: string }[])
    .flatMap((row) => {
      const type = typeByKey.get(row.reaction_key);
      const name = names.get(row.other_profile_id);
      return type && name ? [{ emoji: type.emoji, name, label: row.connection_label }] : [];
    });
  const total = myResults.reduce((sum, item) => sum + item.total, 0);
  const logoUrl = new URL("/logo.png", request.url).toString();

  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden", padding: "70px 66px 58px", color: "white", backgroundImage: "radial-gradient(circle at 8% 5%, rgba(216,180,254,.4), transparent 28%), radial-gradient(circle at 100% 76%, rgba(124,58,237,.55), transparent 35%), linear-gradient(155deg, #5b21b6 0%, #2b125c 48%, #13092f 100%)", fontFamily: "sans-serif" }}>
      <div style={{ position: "absolute", right: "-160px", top: "250px", width: "500px", height: "500px", display: "flex", borderRadius: "999px", border: "3px solid rgba(255,255,255,.05)" }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoUrl} alt="" width={102} height={102} style={{ borderRadius: "24px", objectFit: "cover" }} />
          <div style={{ display: "flex", flexDirection: "column", marginLeft: "22px" }}>
            <span style={{ color: "#ddd6fe", fontSize: "20px", fontWeight: 800, letterSpacing: "4px" }}>VÔLEI POR AMOR</span>
            <span style={{ marginTop: "6px", fontSize: "44px", fontWeight: 900 }}>QUERIDÔMETRO VPA</span>
          </div>
        </div>
        <span style={{ fontSize: "58px" }}>💜</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: "58px" }}>
        <div style={{ width: "262px", height: "262px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "999px", background: "rgba(196,181,253,.16)", border: "8px solid rgba(255,255,255,.86)", boxShadow: "0 0 0 16px rgba(196,181,253,.12)" }}>
          {profile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatar_url} alt="" width={246} height={246} style={{ borderRadius: "999px", objectFit: "cover" }} />
          ) : <span style={{ fontSize: "68px", fontWeight: 900 }}>{initials(profile.full_name)}</span>}
        </div>
        <span style={{ marginTop: "30px", maxWidth: "900px", textAlign: "center", fontSize: "55px", fontWeight: 900 }}>{profile.full_name}</span>
        <span style={{ marginTop: "10px", color: "#ddd6fe", fontSize: "22px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "2px" }}>{formatQueridometroWeek(weekStart)}</span>
        <span style={{ marginTop: "20px", color: "rgba(255,255,255,.65)", fontSize: "22px" }}>{total} {total === 1 ? "carinho recebido" : "carinhos recebidos"} da galera</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", marginTop: "48px", padding: "30px", borderRadius: "30px", background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.14)" }}>
        <span style={{ color: "#c4b5fd", fontSize: "19px", fontWeight: 800, letterSpacing: "3px" }}>MINHAS REAÇÕES</span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "14px", marginTop: "22px" }}>
          {myResults.slice(0, 8).map((result, index) => (
            <div key={result.key} style={{ width: "49%", display: "flex", alignItems: "center", padding: "18px 20px", borderRadius: "20px", background: index === 0 ? "rgba(124,58,237,.34)" : "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)" }}>
              <span style={{ fontSize: "38px" }}>{result.emoji}</span>
              <div style={{ minWidth: 0, display: "flex", flex: 1, flexDirection: "column", marginLeft: "13px" }}>
                <span style={{ fontSize: "18px", fontWeight: 800 }}>{result.label}</span>
                <span style={{ marginTop: "3px", color: "rgba(255,255,255,.5)", fontSize: "14px" }}>{result.total} {result.total === 1 ? "voto" : "votos"}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {connections.length > 0 && <div style={{ display: "flex", flexDirection: "column", marginTop: "28px", padding: "25px 30px", borderRadius: "26px", background: "rgba(244,114,182,.08)", border: "1px solid rgba(244,114,182,.18)" }}>
        <span style={{ fontSize: "20px", fontWeight: 800 }}>CONEXÕES MÚTUAS</span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginTop: "16px" }}>{connections.slice(0, 6).map((connection) => <span key={`${connection.name}-${connection.label}`} style={{ display: "flex", padding: "10px 15px", borderRadius: "999px", background: "rgba(255,255,255,.07)", fontSize: "17px" }}>{connection.emoji} {connection.name} · {connection.label}</span>)}</div>
      </div>}

      <div style={{ display: "flex", flex: 1 }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "24px", borderTop: "1px solid rgba(255,255,255,.12)", color: "rgba(255,255,255,.62)", fontSize: "18px", letterSpacing: "1px" }}>
        <span>COMO A GALERA MARCOU SUA SEMANA? 🏐</span><span>@volei_por_amor</span>
      </div>
    </div>,
    { width: 1080, height: 1920, headers: { "Cache-Control": "private, no-store", "Content-Disposition": `inline; filename="queridometro-${weekStart}.png"` } },
  );
}
