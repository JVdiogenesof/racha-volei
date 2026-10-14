import { ImageResponse } from "next/og";
import { ArtWatermark } from "@/components/ArtWatermark";
import { createClient } from "@/lib/supabase/server";
import { embedAvatarUrls } from "@/lib/serverImageData";
import { VPA_INSTAGRAM_HANDLE } from "@/lib/brand";
import { teamBrandFor } from "@/lib/teamLogos";

export const dynamic = "force-dynamic";

// Arte individual de um time: ?modo=escalacao (antes do racha) ou ?modo=resultado.
// Somente leitura: nada aqui grava dados nem mexe em ranking.
function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

type Line = { opponent: string; won: boolean | null; score: string | null; stage: string | null };

export async function GET(request: Request, context: { params: Promise<{ id: string; teamId: string }> }) {
  const { id, teamId } = await context.params;
  const mode = new URL(request.url).searchParams.get("modo") === "resultado" ? "resultado" : "escalacao";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Não autorizado", { status: 401 });

  const [{ data: event }, { data: team }] = await Promise.all([
    supabase.from("events").select("date, time, location, is_pre_torneio, is_mini_torneio").eq("id", id).maybeSingle(),
    supabase.from("teams").select("id, team_number, name, generation_id, team_generations(event_id)").eq("id", teamId).maybeSingle(),
  ]);
  const generationEvent = (team?.team_generations as unknown as { event_id: string } | null)?.event_id;
  if (!event || !team || generationEvent !== id) return new Response("Time não encontrado", { status: 404 });

  const [{ data: memberRows }, { data: confirmedRows }, { data: setterRows }, { data: teamRows }] = await Promise.all([
    supabase.from("team_members").select("profile_id, profiles(full_name, avatar_url, is_setter)").eq("team_id", teamId),
    supabase.from("attendance").select("profile_id").eq("event_id", id).eq("status", "confirmed"),
    supabase.from("event_setter_overrides").select("profile_id, is_setter").eq("event_id", id),
    supabase.from("teams").select("id, name, team_number").eq("generation_id", team.generation_id),
  ]);
  const confirmed = new Set((confirmedRows ?? []).map((row) => row.profile_id));
  const setters = new Map((setterRows ?? []).map((row) => [row.profile_id, row.is_setter]));
  const players = await embedAvatarUrls(
    (memberRows ?? []).filter((row) => confirmed.has(row.profile_id)).map((row) => {
      const profile = row.profiles as unknown as { full_name: string; avatar_url: string | null; is_setter: boolean } | null;
      return { id: row.profile_id, fullName: profile?.full_name ?? "Jogador", avatarUrl: profile?.avatar_url ?? null, isSetter: setters.get(row.profile_id) ?? profile?.is_setter ?? false };
    }),
  );
  const nameById = new Map((teamRows ?? []).map((row) => [row.id, row.name || `Time ${row.team_number}`]));

  const lines: Line[] = [];
  let wins = 0;
  let losses = 0;
  let placementLabel: string | null = null;
  if (mode === "resultado") {
    if (event.is_pre_torneio || event.is_mini_torneio) {
      const { data: matches } = await supabase.from("tournament_matches").select("stage, team_a_id, team_b_id, score_a, score_b").eq("event_id", id);
      for (const match of matches ?? []) {
        if (match.score_a == null || match.score_b == null) continue;
        if (match.team_a_id !== teamId && match.team_b_id !== teamId) continue;
        const mine = match.team_a_id === teamId ? match.score_a : match.score_b;
        const theirs = match.team_a_id === teamId ? match.score_b : match.score_a;
        const opponentId = match.team_a_id === teamId ? match.team_b_id : match.team_a_id;
        const won = mine === theirs ? null : mine > theirs;
        if (won === true) wins += 1;
        if (won === false) losses += 1;
        lines.push({ opponent: nameById.get(opponentId) ?? "Time", won, score: `${mine} x ${theirs}`, stage: match.stage === "final" ? "Final" : match.stage === "third_place" ? "Disputa de 3º" : null });
        if (match.stage === "final") placementLabel = won ? "CAMPEÃO" : "VICE-CAMPEÃO";
      }
    } else {
      const { data: rows } = await supabase.from("match_wins").select("team_id, loser_team_id, recorded_at").eq("event_id", id).order("recorded_at");
      for (const row of rows ?? []) {
        if (!row.loser_team_id) continue;
        if (row.team_id !== teamId && row.loser_team_id !== teamId) continue;
        const won = row.team_id === teamId;
        if (won) wins += 1; else losses += 1;
        lines.push({ opponent: nameById.get(won ? row.loser_team_id : row.team_id) ?? "Time", won, score: null, stage: null });
      }
    }
    if (!lines.length) return new Response("Ainda não há resultados deste time.", { status: 409 });
  }

  const brand = teamBrandFor(team.name);
  const accent = brand?.accent ?? "#c4b5fd";
  const panel = brand?.panel ?? "#1b222a";
  const glow = brand?.glow ?? "rgba(124,58,237,.35)";
  const dateLabel = new Date(`${event.date}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
  const logoUrl = brand ? new URL(brand.logo, request.url).toString() : null;
  const watermarkUrl = new URL("/logo-vpa-oficial.jpg", request.url).toString();
  const teamName = team.name || `Time ${team.team_number}`;
  const shown = players.slice(0, 12);
  const compact = mode === "resultado" && lines.length > 3;

  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden", padding: "170px 64px 120px", color: "white", backgroundImage: `radial-gradient(circle at 50% 18%, ${glow}, transparent 48%), linear-gradient(170deg, #1a1033 0%, #0d0e24 100%)`, fontFamily: "sans-serif" }}>
      <ArtWatermark src={watermarkUrl} />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <span style={{ color: accent, fontSize: "22px", fontWeight: 900, letterSpacing: "6px" }}>{mode === "resultado" ? (placementLabel ?? "RESULTADO DO RACHA") : "ESCALAÇÃO DO RACHA"}</span>
        <span style={{ marginTop: "8px", color: "rgba(255,255,255,.7)", fontSize: "24px", textTransform: "capitalize" }}>{dateLabel}</span>
      </div>

      <div style={{ display: "flex", justifyContent: "center", marginTop: "22px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", borderRadius: "44px", background: panel, border: `3px solid ${accent}` }}>
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" width={compact ? 560 : 700} style={{ objectFit: "contain" }} />
          ) : (
            <span style={{ padding: "90px 70px", fontSize: "84px", fontWeight: 900 }}>{teamName.toUpperCase()}</span>
          )}
        </div>
      </div>

      {mode === "resultado" ? (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, marginTop: "26px" }}>
          <div style={{ display: "flex", justifyContent: "center", alignItems: "baseline" }}>
            <span style={{ fontSize: "96px", fontWeight: 900, color: "#86efac" }}>{wins}V</span>
            <span style={{ margin: "0 22px", fontSize: "56px", color: "rgba(255,255,255,.35)" }}>·</span>
            <span style={{ fontSize: "96px", fontWeight: 900, color: "#fca5a5" }}>{losses}D</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "14px" }}>
            {lines.slice(0, 8).map((line, index) => (
              <div key={index} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 24px", borderRadius: "20px", background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.1)", fontSize: "26px", fontWeight: 800 }}>
                <span style={{ display: "flex" }}>{line.stage ? `${line.stage} · ` : ""}vs {line.opponent}</span>
                <span style={{ display: "flex", color: line.won === null ? "#e2e8f0" : line.won ? "#86efac" : "#fca5a5" }}>{line.score ? `${line.score} · ` : ""}{line.won === null ? "EMPATE" : line.won ? "VITÓRIA" : "DERROTA"}</span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "8px", marginTop: "auto", paddingBottom: "18px" }}>
            {players.slice(0, 12).map((player) => (
              <span key={player.id} style={{ display: "flex", padding: "8px 16px", borderRadius: "999px", background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.12)", fontSize: "22px", fontWeight: 800 }}>{player.fullName.split(" ").slice(0, 2).join(" ")}</span>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, marginTop: "28px" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
            {shown.map((player) => (
              <div key={player.id} style={{ width: "48.8%", display: "flex", alignItems: "center", padding: "12px 18px 12px 12px", borderRadius: "999px", background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.12)" }}>
                {player.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={player.avatarUrl} alt="" width={64} height={64} style={{ borderRadius: "999px", objectFit: "cover" }} />
                ) : (
                  <span style={{ width: "64px", height: "64px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "999px", background: accent, color: "#0d0e24", fontSize: "18px", fontWeight: 900 }}>{initials(player.fullName)}</span>
                )}
                <span style={{ marginLeft: "12px", maxWidth: "310px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "29px", fontWeight: 800 }}>{player.fullName}</span>
                {player.isSetter && <span style={{ display: "flex", marginLeft: "auto", fontSize: "22px" }}>🏐</span>}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "center", marginTop: "auto", paddingTop: "16px", paddingBottom: "14px", color: "rgba(255,255,255,.55)", fontSize: "22px", fontWeight: 800, letterSpacing: "2px" }}>{event.location ?? ""}{event.time ? ` · ${event.time.slice(0, 5)}` : ""}</div>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "20px", borderTop: "1px solid rgba(255,255,255,.14)", color: "rgba(255,255,255,.62)", fontSize: "18px", fontWeight: 700 }}>
        <span>{mode === "resultado" ? "OBRIGADO POR JOGAR!" : "BORA PRO RACHA!"}</span><span>{VPA_INSTAGRAM_HANDLE}</span>
      </div>
    </div>,
    { width: 1080, height: 1920, headers: { "Cache-Control": "private, no-store", "Content-Disposition": `inline; filename="time-${mode}-${event.date}.png"` } },
  );
}
