import { ImageResponse } from "next/og";
import { VPA_INSTAGRAM_HANDLE } from "@/lib/brand";
import { createClient } from "@/lib/supabase/server";
import { generateRoundRobinPairs, roundRobinPairKey } from "@/lib/torneioStandings";

export const dynamic = "force-dynamic";

type Confrontation = {
  id: string;
  stage: "group" | "final" | "third_place" | "normal";
  teamA: string;
  teamB: string;
  scoreA: number | null;
  scoreB: number | null;
};

function stageLabel(stage: Confrontation["stage"], isMiniTournament: boolean) {
  if (stage === "final") return "FINAL";
  if (stage === "third_place") return isMiniTournament ? "JOGO DOS DOIS ÚLTIMOS" : "3º LUGAR";
  if (stage === "group") return "FASE INICIAL";
  return "CONFRONTO";
}

function formatName(name: string) {
  return name.length > 21 ? `${name.slice(0, 20)}…` : name;
}

function renderConfrontationsArt(
  data: {
    date: string;
    time: string | null;
    location: string | null;
    isPreTournament: boolean;
    isMiniTournament: boolean;
    confrontations: Confrontation[];
  },
  logoUrl: string,
) {
  const date = new Date(`${data.date}T12:00:00`);
  const dateLabel = date.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
  const shownConfrontations = data.confrontations.slice(0, 12);
  const compactRows = shownConfrontations.length > 8;
  const rowHeight = compactRows ? 88 : 108;
  const hasScores = shownConfrontations.some((match) => match.scoreA != null && match.scoreB != null);
  const formatLabel = data.isPreTournament ? "PRÉ-TORNEIO" : data.isMiniTournament ? "MINI TORNEIO" : "RACHA";

  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden", padding: "150px 58px 106px", color: "white", backgroundImage: "radial-gradient(circle at 94% 5%, rgba(167,139,250,.43), transparent 30%), radial-gradient(circle at 2% 92%, rgba(37,99,235,.25), transparent 33%), linear-gradient(155deg, #48218a 0%, #251052 48%, #0c0d2a 100%)", fontFamily: "sans-serif" }}>
      <div style={{ position: "absolute", right: "-180px", top: "360px", width: "520px", height: "520px", display: "flex", borderRadius: "999px", border: "3px solid rgba(255,255,255,.045)" }} />
      <div style={{ position: "absolute", left: "-170px", bottom: "-55px", width: "440px", height: "440px", display: "flex", borderRadius: "999px", border: "3px solid rgba(196,181,253,.05)" }} />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoUrl} alt="" width={94} height={94} style={{ borderRadius: "24px", objectFit: "cover" }} />
          <div style={{ display: "flex", flexDirection: "column", marginLeft: "21px" }}>
            <span style={{ color: "#ddd6fe", fontSize: "19px", fontWeight: 800, letterSpacing: "4px" }}>VÔLEI POR AMOR</span>
            <span style={{ marginTop: "7px", fontSize: "49px", fontWeight: 900, lineHeight: 1 }}>CONFRONTOS</span>
          </div>
        </div>
        <div style={{ width: "94px", height: "94px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "28px", background: "rgba(255,255,255,.09)", border: "1px solid rgba(255,255,255,.13)", fontSize: "47px" }}>⚔️</div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "36px", padding: "20px 26px", borderRadius: "24px", background: "rgba(255,255,255,.085)", border: "1px solid rgba(255,255,255,.13)" }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: "26px", fontWeight: 800, textTransform: "capitalize" }}>{dateLabel}</span>
          <span style={{ marginTop: "6px", fontSize: "18px", color: "rgba(255,255,255,.62)" }}>{data.location ?? "Local a definir"}{data.time ? ` · ${data.time.slice(0, 5)}` : ""}</span>
        </div>
        <span style={{ padding: "11px 17px", borderRadius: "999px", background: data.isPreTournament ? "rgba(251,191,36,.16)" : "rgba(124,58,237,.38)", border: `1px solid ${data.isPreTournament ? "rgba(251,191,36,.33)" : "rgba(196,181,253,.25)"}`, color: data.isPreTournament ? "#fde68a" : "#ede9fe", fontSize: "16px", fontWeight: 900 }}>{formatLabel}</span>
      </div>

      <div style={{ display: "flex", flex: 1, flexDirection: "column", justifyContent: "center" }}>
        <div style={{ display: "flex", alignItems: "center", marginTop: "20px", marginBottom: "14px" }}>
          <span style={{ fontSize: "25px" }}>🏐</span>
          <span style={{ marginLeft: "10px", fontSize: "23px", fontWeight: 800 }}>{hasScores ? "Tabela atualizada" : "Jogos confirmados"}</span>
          <span style={{ marginLeft: "auto", color: "rgba(255,255,255,.58)", fontSize: "17px", fontWeight: 700 }}>{data.confrontations.length} {data.confrontations.length === 1 ? "jogo" : "jogos"}</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: compactRows ? "10px" : "12px" }}>
          {shownConfrontations.map((match, index) => {
            const hasScore = match.scoreA != null && match.scoreB != null;
            return (
              <div key={match.id} style={{ minHeight: `${rowHeight}px`, display: "flex", alignItems: "center", padding: compactRows ? "13px 20px" : "15px 22px", borderRadius: "22px", background: match.stage === "final" ? "linear-gradient(90deg, rgba(245,158,11,.2), rgba(124,58,237,.2))" : "rgba(8,5,31,.34)", border: `1px solid ${match.stage === "final" ? "rgba(251,191,36,.37)" : "rgba(196,181,253,.18)"}` }}>
                <div style={{ width: "128px", display: "flex", flexDirection: "column" }}>
                  <span style={{ color: match.stage === "final" ? "#fde68a" : "#c4b5fd", fontSize: "13px", fontWeight: 900, letterSpacing: "1.4px" }}>{stageLabel(match.stage, data.isMiniTournament)}</span>
                  <span style={{ marginTop: "5px", color: "rgba(255,255,255,.45)", fontSize: "14px", fontWeight: 700 }}>JOGO {index + 1}</span>
                </div>
                <span style={{ width: "250px", textAlign: "right", fontSize: compactRows ? "22px" : "25px", fontWeight: 800 }}>{formatName(match.teamA)}</span>
                <div style={{ width: "132px", display: "flex", justifyContent: "center" }}>
                  <span style={{ minWidth: hasScore ? "84px" : "58px", padding: "10px 12px", textAlign: "center", borderRadius: "14px", background: hasScore ? "rgba(124,58,237,.43)" : "rgba(255,255,255,.08)", color: hasScore ? "white" : "#ddd6fe", fontSize: compactRows ? "20px" : "22px", fontWeight: 900 }}>{hasScore ? `${match.scoreA} × ${match.scoreB}` : "VS"}</span>
                </div>
                <span style={{ width: "250px", fontSize: compactRows ? "22px" : "25px", fontWeight: 800 }}>{formatName(match.teamB)}</span>
              </div>
            );
          })}
        </div>

        {data.confrontations.length > shownConfrontations.length && <span style={{ marginTop: "16px", textAlign: "center", color: "#ddd6fe", fontSize: "16px", fontWeight: 700 }}>+{data.confrontations.length - shownConfrontations.length} confrontos na tabela completa</span>}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: "24px" }}>
          <span style={{ color: "rgba(221,214,254,.32)", fontSize: "47px", fontWeight: 900, letterSpacing: "7px" }}>BORA PRO RACHA</span>
          <span style={{ marginTop: "9px", color: "rgba(255,255,255,.48)", fontSize: "17px", fontWeight: 700, letterSpacing: "1.6px" }}>MARQUE A GALERA E COMPARTILHE 💜</span>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "19px", borderTop: "1px solid rgba(255,255,255,.12)", color: "rgba(255,255,255,.62)", fontSize: "16px", letterSpacing: "1px" }}><span>QUEM VAI LEVAR ESSA?</span><span>{VPA_INSTAGRAM_HANDLE}</span></div>
    </div>,
    { width: 1080, height: 1920, headers: { "Cache-Control": "private, no-store", "Content-Disposition": `inline; filename="confrontos-racha-${data.date}.png"` } },
  );
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Não autorizado", { status: 401 });

  const [{ data: event, error: eventError }, { data: generation, error: generationError }] = await Promise.all([
    supabase.from("events").select("date, time, location, is_pre_torneio, is_mini_torneio").eq("id", id).maybeSingle(),
    supabase.from("team_generations").select("id").eq("event_id", id).order("generated_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (eventError || generationError) return new Response("Não foi possível carregar os confrontos", { status: 500 });
  if (!event) return new Response("Racha não encontrado", { status: 404 });
  if (!generation) return new Response("Os times ainda não foram gerados", { status: 409 });

  const { data: teamRows, error: teamError } = await supabase.from("teams").select("id, team_number, name").eq("generation_id", generation.id).order("team_number");
  if (teamError) return new Response("Não foi possível carregar os times", { status: 500 });
  const teamLabelById = new Map((teamRows ?? []).map((team) => [team.id, team.name || `Time ${team.team_number}`]));
  if (!teamLabelById.size) return new Response("Nenhum time encontrado", { status: 409 });

  let confrontations: Confrontation[] = [];
  if (event.is_pre_torneio || event.is_mini_torneio) {
    const { data: matchRows, error } = await supabase
      .from("tournament_matches")
      .select("id, stage, team_a_id, team_b_id, score_a, score_b")
      .eq("event_id", id);
    if (error) return new Response("Não foi possível carregar a tabela de jogos", { status: 500 });
    const stageOrder = { group: 0, third_place: 1, final: 2 } as const;
    const groupOrder = new Map(
      generateRoundRobinPairs((teamRows ?? []).map((team) => team.id))
        .map(([teamAId, teamBId], index) => [roundRobinPairKey(teamAId, teamBId), index]),
    );
    confrontations = (matchRows ?? [])
      .sort((first, second) => {
        const stageDifference = stageOrder[first.stage as keyof typeof stageOrder] - stageOrder[second.stage as keyof typeof stageOrder];
        if (stageDifference !== 0) return stageDifference;
        if (first.stage !== "group" || second.stage !== "group") return 0;
        return (groupOrder.get(roundRobinPairKey(first.team_a_id, first.team_b_id)) ?? Number.MAX_SAFE_INTEGER)
          - (groupOrder.get(roundRobinPairKey(second.team_a_id, second.team_b_id)) ?? Number.MAX_SAFE_INTEGER);
      })
      .map((match) => ({
        id: match.id,
        stage: match.stage,
        teamA: teamLabelById.get(match.team_a_id) ?? "Time A",
        teamB: teamLabelById.get(match.team_b_id) ?? "Time B",
        scoreA: match.score_a,
        scoreB: match.score_b,
      }));
  } else {
    const { data: winRows, error } = await supabase
      .from("match_wins")
      .select("id, team_id, loser_team_id, recorded_at")
      .eq("event_id", id)
      .not("loser_team_id", "is", null)
      .order("recorded_at");
    if (error) return new Response("Não foi possível carregar os confrontos", { status: 500 });
    confrontations = (winRows ?? []).flatMap((match) => match.loser_team_id ? [{
      id: match.id,
      stage: "normal" as const,
      teamA: teamLabelById.get(match.team_id) ?? "Time vencedor",
      teamB: teamLabelById.get(match.loser_team_id) ?? "Time adversário",
      scoreA: null,
      scoreB: null,
    }] : []);
  }

  if (!confrontations.length) return new Response("Ainda não há confrontos para gerar a arte.", { status: 409 });
  return renderConfrontationsArt({
    date: event.date,
    time: event.time,
    location: event.location,
    isPreTournament: event.is_pre_torneio,
    isMiniTournament: event.is_mini_torneio,
    confrontations,
  }, new URL("/logo.png", request.url).toString());
}
