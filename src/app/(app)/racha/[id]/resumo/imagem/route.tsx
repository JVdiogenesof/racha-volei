import { ImageResponse } from "next/og";
import { ArtWatermark } from "@/components/ArtWatermark";
import { createClient } from "@/lib/supabase/server";
import { getEventSummary } from "@/lib/eventSummary";
import { embedAvatarUrls } from "@/lib/serverImageData";
import { VPA_INSTAGRAM_HANDLE } from "@/lib/brand";

export const dynamic = "force-dynamic";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return new Response("Não autorizado", { status: 401 });

  const summary = await getEventSummary(supabase, id);
  if (!summary) return new Response("Racha não encontrado", { status: 404 });
  if (summary.event.status !== "finished") {
    return new Response("O racha ainda não foi encerrado", { status: 409 });
  }

  const dateLabel = new Date(`${summary.event.date}T00:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const displayedPlayers = await embedAvatarUrls(summary.players.slice(0, 24));
  const hiddenPlayers = Math.max(0, summary.players.length - displayedPlayers.length);
  const watermarkUrl = new URL("/logo-vpa-oficial.jpg", _request.url).toString();
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
          padding: "56px 58px 48px",
          color: "white",
          backgroundImage:
            "radial-gradient(circle at 90% 5%, rgba(167,139,250,.35), transparent 32%), radial-gradient(circle at 5% 92%, rgba(109,40,217,.35), transparent 34%), linear-gradient(155deg, #321d75 0%, #181043 46%, #090d25 100%)",
          fontFamily: "sans-serif",
        }}
      >
        <ArtWatermark src={watermarkUrl} />
        <div style={{ display: "flex", flex: 1, flexDirection: "column", justifyContent: "space-around" }}>
        <div
          style={{
            position: "absolute",
            right: "-90px",
            top: "-100px",
            width: "360px",
            height: "360px",
            borderRadius: "999px",
            border: "2px solid rgba(255,255,255,.08)",
            display: "flex",
          }}
        />

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: "22px", letterSpacing: "5px", color: "#c4b5fd", fontWeight: 700 }}>
                VÔLEI POR AMOR
              </span>
              <span style={{ marginTop: "5px", fontSize: "56px", lineHeight: 1, fontWeight: 800 }}>
                RESUMO DO RACHA
              </span>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "108px",
              height: "108px",
              borderRadius: "28px",
              background: "rgba(124,58,237,.3)",
              border: "1px solid rgba(196,181,253,.25)",
              fontSize: "54px",
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
            marginTop: "40px",
            padding: "26px 30px",
            borderRadius: "24px",
            background: "rgba(255,255,255,.075)",
            border: "1px solid rgba(255,255,255,.1)",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: "30px", fontWeight: 700, textTransform: "capitalize" }}>{dateLabel}</span>
            <span style={{ marginTop: "5px", fontSize: "22px", color: "rgba(255,255,255,.6)" }}>
              {summary.event.location ?? "Racha da galera"}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", marginRight: "34px" }}>
              <span style={{ fontSize: "44px", fontWeight: 800 }}>{summary.totalMatches}</span>
              <span style={{ fontSize: "15px", color: "rgba(255,255,255,.55)", textTransform: "uppercase", letterSpacing: "2px" }}>
                vitórias registradas
              </span>
            </div>
            <div style={{ width: "1px", height: "64px", background: "rgba(255,255,255,.12)" }} />
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", marginLeft: "34px" }}>
              <span style={{ fontSize: "44px", fontWeight: 800, color: "#fcd34d" }}>{summary.bestWinCount}</span>
              <span style={{ fontSize: "15px", color: "rgba(255,255,255,.55)", textTransform: "uppercase", letterSpacing: "2px" }}>
                melhor marca
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", marginTop: "40px", marginBottom: "22px" }}>
          <span style={{ fontSize: "32px" }}>🏆</span>
          <span style={{ marginLeft: "12px", fontSize: "29px", fontWeight: 800 }}>Quem mais venceu no racha</span>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", alignContent: "flex-start" }}>
          {displayedPlayers.map((player, index) => {
            const isLeader = summary.bestWinCount > 0 && player.wins === summary.bestWinCount;
            return (
              <div
                key={player.profileId}
                style={{
                  width: "31.5%",
                  height: "124px",
                  display: "flex",
                  alignItems: "center",
                  padding: "16px 16px",
                  borderRadius: "20px",
                  background: isLeader ? "rgba(251,191,36,.15)" : "rgba(255,255,255,.065)",
                  border: isLeader ? "1px solid rgba(252,211,77,.38)" : "1px solid rgba(255,255,255,.08)",
                }}
              >
                <span
                  style={{
                    width: "34px",
                    height: "34px",
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "999px",
                    background: index < 3 ? "#7c3aed" : "rgba(255,255,255,.1)",
                    color: index < 3 ? "white" : "rgba(255,255,255,.55)",
                    fontSize: "15px",
                    fontWeight: 800,
                  }}
                >
                  {index + 1}
                </span>
                {player.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={player.avatarUrl}
                    alt=""
                    width={68}
                    height={68}
                    style={{ marginLeft: "11px", borderRadius: "999px", objectFit: "cover", border: "2px solid rgba(255,255,255,.18)" }}
                  />
                ) : (
                  <span
                    style={{
                      width: "68px",
                      height: "68px",
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginLeft: "11px",
                      borderRadius: "999px",
                      background: "rgba(124,58,237,.35)",
                      border: "2px solid rgba(255,255,255,.14)",
                      color: "#ddd6fe",
                      fontSize: "20px",
                      fontWeight: 800,
                    }}
                  >
                    {initials(player.fullName)}
                  </span>
                )}
                <div style={{ minWidth: 0, display: "flex", flex: 1, flexDirection: "column", marginLeft: "13px" }}>
                  <span
                    style={{
                      maxWidth: "150px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      fontSize: "19px",
                      fontWeight: 700,
                    }}
                  >
                    {player.fullName}
                  </span>
                  <span style={{ marginTop: "4px", fontSize: "15px", color: isLeader ? "#fde68a" : "#c4b5fd" }}>
                    {player.wins} {player.wins === 1 ? "vitória" : "vitórias"} · {player.teamName}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {hiddenPlayers > 0 && (
          <div style={{ display: "flex", justifyContent: "center", marginTop: "18px", color: "#ddd6fe", fontSize: "16px" }}>
            +{hiddenPlayers} jogadores no resumo completo
          </div>
        )}

        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: "24px",
            paddingTop: "22px",
            borderTop: "1px solid rgba(255,255,255,.1)",
            color: "rgba(255,255,255,.55)",
            fontSize: "17px",
          }}
        >
          <span>MAIS QUE UM JOGO, É A NOSSA RESENHA!</span>
          <span>{VPA_INSTAGRAM_HANDLE}</span>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1920,
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `inline; filename="resumo-racha-${summary.event.date}.png"`,
      },
    },
  );
}
