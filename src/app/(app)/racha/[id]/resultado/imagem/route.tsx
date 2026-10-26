import { ImageResponse } from "next/og";
import { VPA_INSTAGRAM_HANDLE } from "@/lib/brand";
import { teamIconFor } from "@/lib/teamLogos";
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

const placementMeta = {
  1: { label: "CAMPEÃO", icon: "🏆" },
  2: { label: "VICE-CAMPEÃO", icon: "🥈" },
  3: { label: "3º LUGAR", icon: "🥉" },
  4: { label: "4º LUGAR", icon: "🏐" },
} as const;

const PURPLE = "#3a0f85";
const PURPLE_DEEP = "#1c0a4a";
const GOLD = "#fcd34d";
const GOLD_DEEP = "#f59e0b";

function shortName(name: string, limit = 26) {
  return name.length > limit ? `${name.slice(0, limit - 1)}…` : name;
}

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

function InstagramGlyph({ size = 24, color = "#ffffff" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" style={{ display: "flex" }}>
      <rect x="4" y="4" width="40" height="40" rx="12" fill="none" stroke={color} strokeWidth="3.4" />
      <circle cx="24" cy="24" r="10.5" fill="none" stroke={color} strokeWidth="3.4" />
      <circle cx="34.5" cy="13.5" r="2.6" fill={color} />
    </svg>
  );
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
  const crestUrl = new URL("/vpa-nova-logo.png", request.url).toString();
  const sponsorsUrl = new URL("/vpa-patrocinadores.png", request.url).toString();

  const champion = placements.find((entry) => entry.place === 1)!;
  const rest = placements.filter((entry) => entry.place !== 1);

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden", background: `linear-gradient(160deg, ${PURPLE} 0%, ${PURPLE_DEEP} 62%, #0a0620 100%)`, fontFamily: "sans-serif", color: "#fff", padding: "168px 56px 0" }}>
        {/* textura: brasão gigante fantasma, rotacionado, cortado */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={crestUrl} width={1129} height={934} alt="" style={{ position: "absolute", top: "-120px", right: "-260px", width: "980px", height: "810px", opacity: 0.07, transform: "rotate(14deg)" }} />

        {/* faixa diagonal dourada decorativa */}
        <div style={{ position: "absolute", top: "348px", left: "-120px", width: "1320px", height: "10px", background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)`, opacity: 0.5, transform: "rotate(-3deg)" }} />

        <div style={{ display: "flex", width: "100%", flexDirection: "column" }}>
          {/* header */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={crestUrl} width={1129} height={934} alt="" style={{ width: "182px", height: "150px" }} />
            <div style={{ display: "flex", marginTop: "26px", padding: "10px 24px", borderRadius: "999px", border: `2px solid ${GOLD}`, transform: "skewX(-10deg)" }}>
              <span style={{ display: "flex", transform: "skewX(10deg)", color: GOLD, fontSize: "20px", fontWeight: 900, letterSpacing: "4px" }}>{formatLabel}</span>
            </div>
            <span style={{ marginTop: "26px", fontSize: "88px", fontWeight: 900, lineHeight: 0.95, letterSpacing: "-1px", textTransform: "uppercase" }}>Pódio Final</span>
            <span style={{ marginTop: "16px", fontSize: "24px", color: "rgba(255,255,255,.6)", textTransform: "capitalize", fontWeight: 600 }}>{dateLabel}</span>
          </div>

          {/* campeão - hero */}
          <div style={{ display: "flex", flexDirection: "column", marginTop: "104px", position: "relative" }}>
            <div style={{ display: "flex", flexDirection: "column", padding: "66px 42px 52px", borderRadius: "24px", background: `linear-gradient(135deg, ${GOLD} 0%, ${GOLD_DEEP} 100%)`, boxShadow: "0 18px 40px rgba(0,0,0,.35)" }}>
              <div style={{ display: "flex", alignItems: "center" }}>
                {teamIconFor(champion.team.name) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={new URL(teamIconFor(champion.team.name)!, request.url).toString()} alt="" width={180} height={100} style={{ width: "120px", height: "120px", objectFit: "contain", marginRight: "26px" }} />
                )}
                <span style={{ fontSize: "66px", fontWeight: 900, color: PURPLE_DEEP, lineHeight: 1 }}>{shortName(champion.team.name, 16)}</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", marginTop: "44px" }}>
                {champion.team.members.slice(0, 8).map((member, index) => (
                  member.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={`${member.fullName}-${index}`} src={member.avatarUrl} alt="" width={90} height={90} style={{ width: "90px", height: "90px", borderRadius: "999px", objectFit: "cover", border: `3px solid ${GOLD_DEEP}`, marginLeft: index === 0 ? 0 : "-20px", boxShadow: "0 2px 6px rgba(0,0,0,.25)" }} />
                  ) : (
                    <span key={`${member.fullName}-${index}`} style={{ width: "90px", height: "90px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "999px", background: PURPLE_DEEP, color: GOLD, fontSize: "24px", fontWeight: 900, border: `3px solid ${GOLD_DEEP}`, marginLeft: index === 0 ? 0 : "-20px" }}>{initials(member.fullName)}</span>
                  )
                ))}
              </div>
            </div>
            <div style={{ position: "absolute", top: "-22px", right: "24px", display: "flex", padding: "12px 26px", borderRadius: "10px", background: PURPLE_DEEP, border: `2px solid ${GOLD}`, transform: "rotate(5deg)" }}>
              <span style={{ display: "flex", color: GOLD, fontSize: "20px", fontWeight: 900, letterSpacing: "1px", whiteSpace: "nowrap" }}>🏆 CAMPEÃO</span>
            </div>
          </div>

          {/* 2º a 4º - linhas com numeral gigante */}
          <div style={{ display: "flex", flexDirection: "column", marginTop: "56px", gap: "40px" }}>
            {rest.map(({ place, team }) => (
              <div key={team.id} style={{ display: "flex", alignItems: "center", position: "relative", padding: "38px 32px 38px 14px", borderRadius: "18px", background: "rgba(255,255,255,.055)", border: "1px solid rgba(255,255,255,.12)", overflow: "hidden" }}>
                <span style={{ display: "flex", position: "absolute", left: "10px", top: "-36px", fontSize: "172px", fontWeight: 900, color: "rgba(255,255,255,.08)", lineHeight: 1 }}>{place}</span>
                <div style={{ display: "flex", flexDirection: "column", marginLeft: "122px", flex: 1 }}>
                  <span style={{ fontSize: "17px", fontWeight: 800, letterSpacing: "2px", color: "rgba(255,255,255,.55)" }}>{placementMeta[place].icon} {placementMeta[place].label}</span>
                  <div style={{ display: "flex", alignItems: "center", marginTop: "10px" }}>
                    {teamIconFor(team.name) && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={new URL(teamIconFor(team.name)!, request.url).toString()} alt="" width={126} height={70} style={{ width: "52px", height: "52px", objectFit: "contain", marginRight: "16px" }} />
                    )}
                    <span style={{ fontSize: "34px", fontWeight: 900 }}>{shortName(team.name, 18)}</span>
                  </div>
                </div>
                <div style={{ display: "flex" }}>
                  {team.members.slice(0, 4).map((member, index) => (
                    member.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={`${member.fullName}-${index}`} src={member.avatarUrl} alt="" width={50} height={50} style={{ width: "50px", height: "50px", borderRadius: "999px", objectFit: "cover", border: "2px solid rgba(255,255,255,.4)", marginLeft: index === 0 ? 0 : "-15px" }} />
                    ) : (
                      <span key={`${member.fullName}-${index}`} style={{ width: "50px", height: "50px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "999px", background: "rgba(124,58,237,.5)", color: "#ede9fe", fontSize: "13px", fontWeight: 900, border: "2px solid rgba(255,255,255,.4)", marginLeft: index === 0 ? 0 : "-15px" }}>{initials(member.fullName)}</span>
                    )
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* rodapé */}
        <div style={{ display: "flex", flexDirection: "column", marginTop: "auto", marginLeft: "-56px", marginRight: "-56px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "26px 40px", background: "rgba(0,0,0,.22)", borderTop: `2px solid ${GOLD}` }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={sponsorsUrl} width={2176} height={165} alt="" style={{ height: "46px", width: "auto", opacity: 0.92 }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 40px 44px", background: PURPLE_DEEP }}>
            <span style={{ fontSize: "17px", fontWeight: 800, color: "rgba(255,255,255,.7)", letterSpacing: "1px" }}>MAIS QUE UM JOGO, É A NOSSA RESENHA!</span>
            <div style={{ display: "flex", alignItems: "center" }}>
              <InstagramGlyph size={24} color="rgba(255,255,255,.85)" />
              <span style={{ marginLeft: "9px", fontSize: "17px", fontWeight: 800, color: "rgba(255,255,255,.85)" }}>{VPA_INSTAGRAM_HANDLE}</span>
            </div>
          </div>
        </div>
      </div>
    ),
    { width: 1080, height: 1920, headers: { "Cache-Control": "private, no-store", "Content-Disposition": `inline; filename="podio-racha-${event.date}.png"` } },
  );
}
