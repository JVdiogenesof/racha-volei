import { ImageResponse } from "next/og";
import { createClient } from "@/lib/supabase/server";
import { embedAvatarUrls } from "@/lib/serverImageData";
import { VPA_INSTAGRAM_HANDLE } from "@/lib/brand";

export const dynamic = "force-dynamic";

type Destaque = {
  profileId: string;
  fullName: string;
  avatarUrl: string | null;
};

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

  const { data: event, error: eventError } = await supabase
    .from("events")
    .select(
      "date, location, status, community, mvp_profile_id, mvp_profile_id_2, mvp1:profiles!events_mvp_profile_id_profiles_id_fk(id, full_name, avatar_url), mvp2:profiles!events_mvp_profile_id_2_profiles_id_fk(id, full_name, avatar_url)",
    )
    .eq("id", id)
    .maybeSingle();
  if (eventError) return new Response(eventError.message, { status: 500 });
  if (!event) return new Response("Racha não encontrado", { status: 404 });
  if (event.status !== "finished") return new Response("O racha ainda não foi encerrado", { status: 409 });

  const profileRows = [event.mvp1, event.mvp2]
    .map((profile) => profile as unknown as { id: string; full_name: string; avatar_url: string | null } | null)
    .filter((profile): profile is NonNullable<typeof profile> => Boolean(profile));
  const uniqueProfiles = profileRows.filter((profile, index) => profileRows.findIndex((item) => item.id === profile.id) === index);
  const destaques = await embedAvatarUrls<Destaque>(
    uniqueProfiles.map((profile) => ({ profileId: profile.id, fullName: profile.full_name, avatarUrl: profile.avatar_url })),
  );
  if (!destaques.length) return new Response("Os Jogadores Destaque ainda não foram escolhidos", { status: 409 });

  const dateLabel = new Date(`${event.date}T00:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const communityLabel = event.community === "sand" ? "RACHA DE AREIA" : "RACHA DE QUADRA";

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
          padding: "72px 64px 52px",
          color: "white",
          backgroundImage:
            "radial-gradient(circle at 12% 12%, rgba(192,132,252,.4), transparent 28%), radial-gradient(circle at 88% 72%, rgba(124,58,237,.42), transparent 34%), linear-gradient(155deg, #3b1676 0%, #1b1046 50%, #090b21 100%)",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ position: "absolute", top: "-110px", right: "-90px", width: "390px", height: "390px", display: "flex", borderRadius: "999px", border: "2px solid rgba(255,255,255,.08)" }} />
        <div style={{ position: "absolute", bottom: "140px", left: "-150px", width: "430px", height: "430px", display: "flex", borderRadius: "999px", border: "2px solid rgba(196,181,253,.07)" }} />

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: "20px", fontWeight: 800, letterSpacing: "5px", color: "#d8b4fe" }}>VÔLEI POR AMOR</span>
            <span style={{ marginTop: "8px", fontSize: "58px", lineHeight: 1, fontWeight: 900 }}>DESTAQUES</span>
            <span style={{ marginTop: "4px", fontSize: "37px", lineHeight: 1, fontWeight: 700, color: "#c4b5fd" }}>DO RACHA</span>
          </div>
          <div style={{ width: "104px", height: "104px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "30px", background: "rgba(245,158,11,.17)", border: "1px solid rgba(253,230,138,.28)", fontSize: "55px" }}>🏆</div>
        </div>

        <div style={{ marginTop: "32px", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 24px", borderRadius: "20px", background: "rgba(255,255,255,.075)", border: "1px solid rgba(255,255,255,.1)" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: "24px", fontWeight: 800, textTransform: "capitalize" }}>{dateLabel}</span>
            <span style={{ marginTop: "4px", fontSize: "17px", color: "rgba(255,255,255,.58)" }}>{event.location ?? "Vôlei Por Amor"}</span>
          </div>
          <span style={{ padding: "10px 17px", borderRadius: "999px", background: "rgba(124,58,237,.3)", color: "#ddd6fe", fontSize: "15px", fontWeight: 800, letterSpacing: "1.5px" }}>{communityLabel}</span>
        </div>

        <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center", gap: destaques.length > 1 ? "28px" : "0" }}>
          {destaques.map((destaque, index) => (
            <div key={destaque.profileId} style={{ width: destaques.length > 1 ? "48%" : "68%", minHeight: "660px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "38px 26px", borderRadius: "42px", background: "linear-gradient(180deg, rgba(255,255,255,.13), rgba(255,255,255,.055))", border: "1px solid rgba(216,180,254,.25)", boxShadow: "0 30px 80px rgba(0,0,0,.25)" }}>
              <span style={{ marginBottom: "24px", padding: "9px 16px", borderRadius: "999px", background: "rgba(245,158,11,.16)", color: "#fde68a", fontSize: "16px", fontWeight: 800, letterSpacing: "2px" }}>{destaques.length > 1 ? `DESTAQUE ${index + 1}` : "JOGADOR DESTAQUE"}</span>
              {destaque.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={destaque.avatarUrl} alt="" width={destaques.length > 1 ? 310 : 390} height={destaques.length > 1 ? 310 : 390} style={{ borderRadius: "999px", objectFit: "cover", border: "8px solid rgba(255,255,255,.92)", boxShadow: "0 0 0 12px rgba(139,92,246,.38)" }} />
              ) : (
                <div style={{ width: destaques.length > 1 ? "310px" : "390px", height: destaques.length > 1 ? "310px" : "390px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "999px", background: "linear-gradient(145deg, #8b5cf6, #4c1d95)", border: "8px solid rgba(255,255,255,.92)", boxShadow: "0 0 0 12px rgba(139,92,246,.38)", color: "white", fontSize: destaques.length > 1 ? "94px" : "116px", fontWeight: 900 }}>{initials(destaque.fullName)}</div>
              )}
              <span style={{ marginTop: "34px", maxWidth: "100%", textAlign: "center", fontSize: destaques.length > 1 ? "38px" : "48px", lineHeight: 1.08, fontWeight: 900 }}>{destaque.fullName}</span>
              <span style={{ marginTop: "14px", color: "#d8b4fe", fontSize: "19px", fontWeight: 700 }}>
                {event.community === "sand" ? "BRILHOU NA AREIA ✨" : "BRILHOU EM QUADRA ✨"}
              </span>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "24px", borderTop: "1px solid rgba(255,255,255,.1)", color: "rgba(255,255,255,.58)", fontSize: "17px" }}>
          <span>JOGOU MUITO. REPRESENTOU O VPA.</span>
          <span>{VPA_INSTAGRAM_HANDLE}</span>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1350,
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `inline; filename="destaques-racha-${event.date}.png"`,
      },
    },
  );
}
