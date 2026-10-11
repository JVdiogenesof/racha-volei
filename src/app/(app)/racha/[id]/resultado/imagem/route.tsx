import { ImageResponse } from "next/og";
import { ArtWatermark } from "@/components/ArtWatermark";
import { VPA_INSTAGRAM_HANDLE } from "@/lib/brand";
import { computeStandings } from "@/lib/torneioStandings";
import { createClient } from "@/lib/supabase/server";
import { embedAvatarUrls } from "@/lib/serverImageData";

export const dynamic = "force-dynamic";

type ResultTeam = { id: string; name: string; members: { fullName: string; avatarUrl: string | null }[] };
type MatchRow = {
  stage: "group" | "final" | "third_place";
  team_a_id: string;
  team_b_id: string;
  score_a: number | null;
  score_b: number | null;
};

const placementStyles = {
  1: { label: "CAMPEÃO", icon: "🏆", color: "#fcd34d", background: "rgba(245,158,11,.18)", border: "rgba(252,211,77,.52)" },
  2: { label: "VICE-CAMPEÃO", icon: "🥈", color: "#e2e8f0", background: "rgba(226,232,240,.11)", border: "rgba(226,232,240,.30)" },
  3: { label: "3º LUGAR", icon: "🥉", color: "#fdba74", background: "rgba(249,115,22,.14)", border: "rgba(251,146,60,.32)" },
  4: { label: "4º LUGAR", icon: "🏐", color: "#ddd6fe", background: "rgba(255,255,255,.055)", border: "rgba(255,255,255,.13)" },
} as const;

function shortName(name: string, limit = 30) {
  return name.length > limit ? `${name.slice(0, limit - 1)}…` : name;
}

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Não autorizado", { status: 401 });

  const [{ data: event, error: eventError }, { data: generation, error: generationError }] = await Promise.all([
    supabase.from("events").select("date, is_pre_torneio, is_mini_torneio").eq("id", id).maybeSingle(),
    supabase.from("team_generations").select("id").eq("event_id", id).order("generated_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (eventError || generationError) return new Response("Não foi possível carregar o resultado", { status: 500 });
  if (!event || (!event.is_pre_torneio && !event.is_mini_torneio)) return new Response("Resultado não encontrado", { status: 404 });
  if (!generation) return new Response("Os times ainda não foram gerados", { status: 409 });

  const [{ data: teamRows, error: teamsError }, { data: matchRows, error: matchesError }] = await Promise.all([
    supabase.from("teams").select("id, team_number, name").eq("generation_id", generation.id).order("team_number"),
    supabase.from("tournament_matches").select("stage, team_a_id, team_b_id, score_a, score_b").eq("event_id", id),
  ]);
  if (teamsError || matchesError) return new Response("Não foi possível carregar o pódio", { status: 500 });
  const teamIds = (teamRows ?? []).map((team) => team.id);
  const { data: memberRows, error: membersError } = teamIds.length
    ? await supabase.from("team_members").select("team_id, profile_id, profiles(full_name, avatar_url)").in("team_id", teamIds)
    : { data: [], error: null };
  if (membersError) return new Response("Não foi possível carregar os jogadores", { status: 500 });

  const members = await embedAvatarUrls((memberRows ?? []).map((member) => {
    const profile = member.profiles as unknown as { full_name: string; avatar_url: string | null } | null;
    return {
      id: member.profile_id,
      teamId: member.team_id,
      fullName: profile?.full_name ?? "Jogador",
      avatarUrl: profile?.avatar_url ?? null,
    };
  }));

  const teams: ResultTeam[] = (teamRows ?? []).map((team) => ({
    id: team.id,
    name: team.name || `Time ${team.team_number}`,
    members: members
      .filter((member) => member.teamId === team.id)
      .map((member) => ({ fullName: member.fullName, avatarUrl: member.avatarUrl })),
  }));
  const matches = (matchRows ?? []) as MatchRow[];
  const finalMatch = matches.find((match) => match.stage === "final");
  if (!finalMatch || finalMatch.score_a == null || finalMatch.score_b == null) {
    return new Response("O pódio estará disponível após o placar da final.", { status: 409 });
  }

  const standings = computeStandings(
    (teamRows ?? []).map((team) => ({ id: team.id, teamNumber: team.team_number, name: team.name })),
    matches.filter((match) => match.stage === "group").map((match) => ({
      teamAId: match.team_a_id,
      teamBId: match.team_b_id,
      scoreA: match.score_a,
      scoreB: match.score_b,
    })),
  );
  const thirdPlaceMatch = matches.find((match) => match.stage === "third_place");
  const championId = finalMatch.score_a > finalMatch.score_b ? finalMatch.team_a_id : finalMatch.team_b_id;
  const runnerUpId = championId === finalMatch.team_a_id ? finalMatch.team_b_id : finalMatch.team_a_id;
  const thirdId = thirdPlaceMatch?.score_a != null && thirdPlaceMatch.score_b != null
    ? thirdPlaceMatch.score_a > thirdPlaceMatch.score_b ? thirdPlaceMatch.team_a_id : thirdPlaceMatch.team_b_id
    : standings[2]?.teamId;
  const fourthId = thirdPlaceMatch?.score_a != null && thirdPlaceMatch.score_b != null
    ? thirdId === thirdPlaceMatch.team_a_id ? thirdPlaceMatch.team_b_id : thirdPlaceMatch.team_a_id
    : standings[3]?.teamId;
  const teamById = new Map(teams.map((team) => [team.id, team]));
  const placements = [championId, runnerUpId, thirdId, fourthId]
    .map((teamId, index) => ({ place: (index + 1) as 1 | 2 | 3 | 4, team: teamId ? teamById.get(teamId) : undefined }))
    .filter((entry): entry is { place: 1 | 2 | 3 | 4; team: ResultTeam } => Boolean(entry.team));
  const dateLabel = new Date(`${event.date}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  const formatLabel = event.is_pre_torneio ? "PRÉ-TORNEIO VPA" : "MINI TORNEIO VPA";
  const watermarkUrl = new URL("/logo-vpa-oficial.jpg", request.url).toString();

  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", overflow: "hidden", padding: "238px 58px 102px", color: "white", backgroundImage: "radial-gradient(circle at 92% 4%, rgba(251,191,36,.24), transparent 25%), radial-gradient(circle at 4% 88%, rgba(124,58,237,.45), transparent 32%), linear-gradient(155deg, #43207f 0%, #24104e 47%, #0b0d28 100%)", fontFamily: "sans-serif" }}>
      <ArtWatermark src={watermarkUrl} />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
        <div style={{ width: "106px", height: "106px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "34px", background: "rgba(251,191,36,.13)", border: "1px solid rgba(252,211,77,.4)", fontSize: "57px" }}>🏆</div>
        <span style={{ marginTop: "20px", color: "#fcd34d", fontSize: "19px", fontWeight: 900, letterSpacing: "4px" }}>{formatLabel}</span>
        <span style={{ marginTop: "10px", fontSize: "56px", fontWeight: 900, lineHeight: 1 }}>PÓDIO FINAL</span>
        <span style={{ marginTop: "12px", color: "rgba(255,255,255,.65)", fontSize: "21px", textTransform: "capitalize" }}>{dateLabel}</span>
      </div>

      <div style={{ display: "flex", flex: 1, flexDirection: "column", justifyContent: "center", marginTop: "34px", gap: "14px" }}>
        {placements.map(({ place, team }) => {
          const style = placementStyles[place];
          return (
            <div key={team.id} style={{ display: "flex", flexDirection: "column", padding: place === 1 ? "26px 28px" : "20px 24px", borderRadius: "28px", background: style.background, border: `1px solid ${style.border}` }}>
              <div style={{ display: "flex", alignItems: "center" }}>
                <div style={{ width: place === 1 ? "66px" : "55px", height: place === 1 ? "66px" : "55px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "999px", background: "rgba(255,255,255,.11)", color: style.color, fontSize: place === 1 ? "34px" : "28px" }}>{style.icon}</div>
                <div style={{ display: "flex", flexDirection: "column", marginLeft: "17px" }}>
                  <span style={{ color: style.color, fontSize: "16px", fontWeight: 900, letterSpacing: "2px" }}>{style.label}</span>
                  <span style={{ marginTop: "4px", fontSize: place === 1 ? "35px" : "28px", fontWeight: 900 }}>{shortName(team.name)}</span>
                </div>
                <span style={{ marginLeft: "auto", color: "rgba(255,255,255,.56)", fontSize: "20px", fontWeight: 800 }}>{place}º</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "17px" }}>
                {team.members.slice(0, 8).map((member, index) => (
                  <div key={`${member.fullName}-${index}`} style={{ display: "flex", alignItems: "center", padding: "5px 10px 5px 5px", borderRadius: "999px", background: "rgba(4,3,20,.25)", border: "1px solid rgba(255,255,255,.08)", color: "rgba(255,255,255,.9)", fontSize: "16px", fontWeight: 700 }}>
                    {member.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={member.avatarUrl} alt="" width={30} height={30} style={{ borderRadius: "999px", objectFit: "cover", border: "1px solid rgba(255,255,255,.2)" }} />
                    ) : (
                      <span style={{ width: "30px", height: "30px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "999px", background: "rgba(124,58,237,.48)", color: "#ede9fe", fontSize: "10px", fontWeight: 900 }}>{initials(member.fullName)}</span>
                    )}
                    <span style={{ marginLeft: "7px" }}>{shortName(member.fullName, 17)}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "22px", borderTop: "1px solid rgba(255,255,255,.12)", color: "rgba(255,255,255,.64)", fontSize: "17px", fontWeight: 700 }}><span>MAIS QUE UM JOGO, É A NOSSA RESENHA!</span><span>{VPA_INSTAGRAM_HANDLE}</span></div>
    </div>,
    { width: 1080, height: 1920, headers: { "Cache-Control": "private, no-store", "Content-Disposition": `inline; filename="podio-racha-${event.date}.png"` } },
  );
}
