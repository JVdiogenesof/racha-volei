import { ImageResponse } from "next/og";
import { createClient } from "@/lib/supabase/server";
import { embedAvatarUrls } from "@/lib/serverImageData";

export const dynamic = "force-dynamic";

type ArtPlayer = { id: string; fullName: string; avatarUrl: string | null; isSetter: boolean };
export type TeamsArtData = {
  date: string;
  time: string | null;
  location: string | null;
  isPreTournament: boolean;
  teams: { id: string; teamNumber: number; members: ArtPlayer[] }[];
};

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

export function renderTeamsArt(data: TeamsArtData, logoUrl: string) {
  const date = new Date(`${data.date}T12:00:00`);
  const dateLabel = date.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
  const displayedTeams = data.teams.slice(0, 6);
  const totalPlayers = data.teams.reduce((sum, team) => sum + team.members.length, 0);
  const cardWidth = displayedTeams.length <= 4 ? "49.2%" : "32.4%";
  const compactCards = displayedTeams.length > 4;

  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden", padding: "64px 58px 52px", color: "white", backgroundImage: "radial-gradient(circle at 94% 5%, rgba(167,139,250,.42), transparent 30%), radial-gradient(circle at 2% 92%, rgba(37,99,235,.26), transparent 33%), linear-gradient(155deg, #48218a 0%, #251052 46%, #0c0d2a 100%)", fontFamily: "sans-serif" }}>
      <div style={{ position: "absolute", right: "-170px", top: "250px", width: "500px", height: "500px", display: "flex", borderRadius: "999px", border: "3px solid rgba(255,255,255,.045)" }} />
      <div style={{ position: "absolute", left: "-160px", bottom: "80px", width: "430px", height: "430px", display: "flex", borderRadius: "999px", border: "3px solid rgba(196,181,253,.05)" }} />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoUrl} alt="" width={104} height={104} style={{ borderRadius: "24px", objectFit: "cover" }} />
          <div style={{ display: "flex", flexDirection: "column", marginLeft: "22px" }}>
            <span style={{ color: "#ddd6fe", fontSize: "20px", fontWeight: 800, letterSpacing: "4px" }}>VÔLEI POR AMOR</span>
            <span style={{ marginTop: "6px", fontSize: "52px", fontWeight: 900, lineHeight: 1 }}>TIMES DO RACHA</span>
          </div>
        </div>
        <div style={{ width: "104px", height: "104px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "28px", background: "rgba(255,255,255,.09)", border: "1px solid rgba(255,255,255,.13)", fontSize: "52px" }}>🏐</div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "38px", padding: "24px 28px", borderRadius: "25px", background: "rgba(255,255,255,.085)", border: "1px solid rgba(255,255,255,.13)" }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: "27px", fontWeight: 800, textTransform: "capitalize" }}>{dateLabel}</span>
          <span style={{ marginTop: "6px", fontSize: "19px", color: "rgba(255,255,255,.62)" }}>{data.location ?? "Local a definir"}{data.time ? ` · ${data.time.slice(0, 5)}` : ""}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center" }}>
          {data.isPreTournament && <span style={{ marginRight: "14px", padding: "10px 15px", borderRadius: "999px", background: "rgba(251,191,36,.13)", border: "1px solid rgba(251,191,36,.3)", color: "#fde68a", fontSize: "14px", fontWeight: 800 }}>PRÉ-TORNEIO</span>}
          <span style={{ padding: "12px 18px", borderRadius: "18px", background: "#7c3aed", fontSize: "18px", fontWeight: 800 }}>{totalPlayers} JOGADORES</span>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", marginTop: "30px", marginBottom: "17px" }}>
        <span style={{ fontSize: "28px" }}>✨</span><span style={{ marginLeft: "11px", fontSize: "24px", fontWeight: 800 }}>Escalações confirmadas</span>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignContent: "flex-start" }}>
        {displayedTeams.map((team) => (
          <div key={team.id} style={{ width: cardWidth, minHeight: "455px", display: "flex", flexDirection: "column", overflow: "hidden", borderRadius: "24px", background: "rgba(6,4,25,.24)", border: "1px solid rgba(196,181,253,.2)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: compactCards ? "17px 18px" : "19px 22px", background: "linear-gradient(90deg, rgba(124,58,237,.42), rgba(124,58,237,.12))", borderBottom: "1px solid rgba(255,255,255,.09)" }}>
              <span style={{ fontSize: compactCards ? "22px" : "25px", fontWeight: 900 }}>TIME {team.teamNumber}</span>
              <span style={{ width: "36px", height: "36px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "999px", background: "rgba(255,255,255,.1)", color: "#ddd6fe", fontSize: "16px", fontWeight: 900 }}>{team.members.length}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", padding: compactCards ? "12px 15px 15px" : "14px 18px 18px" }}>
              {team.members.slice(0, 8).map((member) => (
                <div key={member.id} style={{ minWidth: 0, display: "flex", alignItems: "center", height: compactCards ? "50px" : "52px", borderBottom: "1px solid rgba(255,255,255,.055)" }}>
                  {member.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={member.avatarUrl} alt="" width={compactCards ? 30 : 34} height={compactCards ? 30 : 34} style={{ flexShrink: 0, borderRadius: "999px", objectFit: "cover", border: "1px solid rgba(196,181,253,.4)" }} />
                  ) : (
                    <span style={{ width: compactCards ? "30px" : "34px", height: compactCards ? "30px" : "34px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "999px", background: "rgba(124,58,237,.42)", color: "#ede9fe", fontSize: "11px", fontWeight: 900 }}>{initials(member.fullName)}</span>
                  )}
                  <span style={{ minWidth: 0, maxWidth: compactCards ? "225px" : "360px", marginLeft: "9px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: compactCards ? "15px" : "18px", fontWeight: 700 }}>{member.fullName}</span>
                  {member.isSetter && <span style={{ marginLeft: "auto", color: "#c4b5fd", fontSize: "13px" }}>🏐</span>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {data.teams.length > displayedTeams.length && <div style={{ display: "flex", justifyContent: "center", marginTop: "16px", color: "#ddd6fe", fontSize: "17px" }}>+{data.teams.length - displayedTeams.length} times na lista completa</div>}
      <div style={{ display: "flex", flex: 1, flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ color: "rgba(221,214,254,.22)", fontSize: "58px", fontWeight: 900, letterSpacing: "8px" }}>BORA PRO RACHA</span>
        <span style={{ marginTop: "10px", color: "rgba(255,255,255,.45)", fontSize: "18px", fontWeight: 700, letterSpacing: "2px" }}>MARQUE SEU TIME E COMPARTILHE 💜</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "22px", borderTop: "1px solid rgba(255,255,255,.12)", color: "rgba(255,255,255,.62)", fontSize: "17px", letterSpacing: "1px" }}><span>TIMES PRONTOS. AGORA É BOLA PRA CIMA!</span><span>@volei_por_amor</span></div>
    </div>,
    { width: 1080, height: 1920, headers: { "Cache-Control": "private, no-store", "Content-Disposition": `inline; filename="times-racha-${data.date}.png"` } },
  );
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Não autorizado", { status: 401 });

  const [{ data: event, error: eventError }, { data: generation, error: generationError }] = await Promise.all([
    supabase.from("events").select("date, time, location, is_pre_torneio").eq("id", id).maybeSingle(),
    supabase.from("team_generations").select("id").eq("event_id", id).order("generated_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (eventError || generationError) return new Response("Não foi possível carregar os times", { status: 500 });
  if (!event) return new Response("Racha não encontrado", { status: 404 });
  if (!generation) return new Response("Os times ainda não foram gerados", { status: 409 });

  const { data: teamRows, error: teamError } = await supabase.from("teams").select("id, team_number").eq("generation_id", generation.id).order("team_number");
  if (teamError) return new Response("Não foi possível carregar os times", { status: 500 });
  const teamIds = (teamRows ?? []).map((team) => team.id);
  if (!teamIds.length) return new Response("Nenhum time encontrado", { status: 409 });

  const [{ data: memberRows, error: memberError }, { data: confirmedRows, error: confirmedError }] = await Promise.all([
    supabase.from("team_members").select("team_id, profile_id, profiles(full_name, avatar_url, is_setter)").in("team_id", teamIds),
    supabase.from("attendance").select("profile_id").eq("event_id", id).eq("status", "confirmed"),
  ]);
  if (memberError || confirmedError) return new Response("Não foi possível carregar os jogadores", { status: 500 });

  const confirmedIds = new Set((confirmedRows ?? []).map((row) => row.profile_id));
  const players = await embedAvatarUrls((memberRows ?? []).filter((row) => confirmedIds.has(row.profile_id)).map((row) => {
    const profile = row.profiles as unknown as { full_name: string; avatar_url: string | null; is_setter: boolean } | null;
    return { id: row.profile_id, teamId: row.team_id, fullName: profile?.full_name ?? "Jogador", avatarUrl: profile?.avatar_url ?? null, isSetter: profile?.is_setter ?? false };
  }));
  const data: TeamsArtData = {
    date: event.date,
    time: event.time,
    location: event.location,
    isPreTournament: event.is_pre_torneio,
    teams: (teamRows ?? []).map((team) => ({ id: team.id, teamNumber: team.team_number, members: players.filter((player) => player.teamId === team.id) })),
  };
  return renderTeamsArt(data, new URL("/logo.png", request.url).toString());
}
