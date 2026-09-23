import { ImageResponse } from "next/og";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return new Response("Não autorizado", { status: 401 });

  const [{ data: event, error: eventError }, { data: attendanceRows, error: attendanceError }] = await Promise.all([
    supabase
      .from("events")
      .select("date, time, location, official_list_open, status")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("attendance")
      .select("profile_id, confirmed_at, profiles(full_name, avatar_url, is_setter)")
      .eq("event_id", id)
      .eq("status", "confirmed")
      .order("confirmed_at", { ascending: true }),
  ]);

  if (eventError || attendanceError) return new Response("Não foi possível carregar a lista", { status: 500 });
  if (!event) return new Response("Racha não encontrado", { status: 404 });
  if (!event.official_list_open) return new Response("A lista ainda não foi publicada", { status: 409 });
  if (event.status === "cancelled") return new Response("O racha foi cancelado", { status: 409 });

  const players = (attendanceRows ?? []).map((row) => {
    const profile = row.profiles as unknown as {
      full_name: string;
      avatar_url: string | null;
      is_setter: boolean;
    } | null;
    return {
      id: row.profile_id,
      fullName: profile?.full_name ?? "Jogador",
      avatarUrl: profile?.avatar_url ?? null,
      isSetter: profile?.is_setter ?? false,
    };
  });

  const displayedPlayers = players.slice(0, 30);
  const hiddenPlayers = Math.max(0, players.length - displayedPlayers.length);
  const date = new Date(`${event.date}T00:00:00`);
  const weekday = date.toLocaleDateString("pt-BR", { weekday: "long" });
  const dateLabel = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });
  const logoUrl = new URL("/logo.png", request.url).toString();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          overflow: "hidden",
          padding: "70px 64px 58px",
          color: "white",
          backgroundImage:
            "radial-gradient(circle at 92% 8%, rgba(196,181,253,.32), transparent 29%), radial-gradient(circle at 0% 100%, rgba(124,58,237,.45), transparent 34%), linear-gradient(155deg, #48218a 0%, #24104f 47%, #120a2e 100%)",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            right: "-160px",
            top: "270px",
            width: "470px",
            height: "470px",
            display: "flex",
            borderRadius: "999px",
            border: "3px solid rgba(255,255,255,.045)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: "-130px",
            bottom: "110px",
            width: "390px",
            height: "390px",
            display: "flex",
            borderRadius: "999px",
            border: "3px solid rgba(196,181,253,.055)",
          }}
        />

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoUrl}
              alt=""
              width={112}
              height={112}
              style={{ borderRadius: "25px", objectFit: "cover" }}
            />
            <div style={{ display: "flex", flexDirection: "column", marginLeft: "24px" }}>
              <span style={{ color: "#c4b5fd", fontSize: "22px", fontWeight: 700, letterSpacing: "4px" }}>
                VÔLEI POR AMOR
              </span>
              <span style={{ marginTop: "6px", fontSize: "57px", fontWeight: 900, lineHeight: 1 }}>
                LISTA CONFIRMADA
              </span>
            </div>
          </div>
          <div
            style={{
              width: "112px",
              height: "112px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "999px",
              background: "rgba(255,255,255,.09)",
              border: "2px solid rgba(255,255,255,.12)",
              fontSize: "56px",
            }}
          >
            🏐
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: "46px",
            padding: "30px 34px",
            borderRadius: "28px",
            background: "rgba(255,255,255,.09)",
            border: "1px solid rgba(255,255,255,.14)",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ color: "#ddd6fe", fontSize: "22px", fontWeight: 700, textTransform: "uppercase" }}>
              {weekday}
            </span>
            <span style={{ marginTop: "4px", fontSize: "45px", fontWeight: 900, textTransform: "capitalize" }}>
              {dateLabel}
            </span>
            <span style={{ marginTop: "8px", color: "rgba(255,255,255,.7)", fontSize: "23px" }}>
              {event.location ?? "Local a definir"}
              {event.time ? ` · ${event.time.slice(0, 5)}` : ""}
            </span>
          </div>
          <div
            style={{
              minWidth: "178px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              padding: "20px 24px",
              borderRadius: "24px",
              background: "#7c3aed",
            }}
          >
            <span style={{ fontSize: "54px", fontWeight: 900, lineHeight: 1 }}>{players.length}</span>
            <span style={{ marginTop: "7px", fontSize: "17px", fontWeight: 700, letterSpacing: "2px" }}>
              CONFIRMADOS
            </span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", marginTop: "42px", marginBottom: "20px" }}>
          <span style={{ fontSize: "30px" }}>✓</span>
          <span style={{ marginLeft: "12px", fontSize: "28px", fontWeight: 800 }}>Quem vai estar na quadra</span>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignContent: "flex-start" }}>
          {displayedPlayers.map((player, index) => (
            <div
              key={player.id}
              style={{
                width: "49.35%",
                height: "72px",
                display: "flex",
                alignItems: "center",
                padding: "10px 14px",
                borderRadius: "18px",
                background: "rgba(255,255,255,.075)",
                border: "1px solid rgba(255,255,255,.105)",
              }}
            >
              <span
                style={{
                  width: "31px",
                  flexShrink: 0,
                  display: "flex",
                  justifyContent: "center",
                  color: "#a78bfa",
                  fontSize: "15px",
                  fontWeight: 800,
                }}
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              {player.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={player.avatarUrl}
                  alt=""
                  width={48}
                  height={48}
                  style={{ marginLeft: "8px", borderRadius: "999px", objectFit: "cover", border: "2px solid rgba(196,181,253,.42)" }}
                />
              ) : (
                <span
                  style={{
                    width: "48px",
                    height: "48px",
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginLeft: "8px",
                    borderRadius: "999px",
                    background: "rgba(124,58,237,.45)",
                    border: "2px solid rgba(196,181,253,.3)",
                    color: "#ede9fe",
                    fontSize: "16px",
                    fontWeight: 800,
                  }}
                >
                  {initials(player.fullName)}
                </span>
              )}
              <div style={{ minWidth: 0, display: "flex", flex: 1, flexDirection: "column", marginLeft: "12px" }}>
                <span
                  style={{
                    maxWidth: "320px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    fontSize: "19px",
                    fontWeight: 700,
                  }}
                >
                  {player.fullName}
                </span>
                {player.isSetter && (
                  <span style={{ marginTop: "3px", color: "#c4b5fd", fontSize: "13px", fontWeight: 700 }}>
                    🏐 LEVANTADOR(A)
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {hiddenPlayers > 0 && (
          <div style={{ display: "flex", justifyContent: "center", marginTop: "18px", color: "#ddd6fe", fontSize: "18px" }}>
            +{hiddenPlayers} jogadores confirmados
          </div>
        )}

        <div style={{ display: "flex", flex: 1 }} />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: "24px",
            borderTop: "1px solid rgba(255,255,255,.12)",
            color: "rgba(255,255,255,.64)",
            fontSize: "18px",
            letterSpacing: "1px",
          }}
        >
          <span>A GALERA ESTÁ CONFIRMADA. AGORA É SÓ JOGAR!</span>
          <span>@volei_por_amor</span>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1920,
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `inline; filename="confirmados-${event.date}.png"`,
      },
    },
  );
}
