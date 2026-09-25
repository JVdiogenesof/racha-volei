import { ImageResponse } from "next/og";
import { createClient } from "@/lib/supabase/server";
import { getRankingCounts } from "@/lib/rankings";
import { getAttendanceStreaks } from "@/lib/streak";
import { getFeaturedAchievements, getPlayerAchievements } from "@/lib/achievements";
import { getPlayerRankingPositions } from "@/lib/playerCard";
import { imageUrlToDataUrl } from "@/lib/serverImageData";

export const dynamic = "force-dynamic";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function rankLabel(position: number | null) {
  return position ? `#${position} NO RANKING` : "SEM POSIÇÃO";
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return new Response("Não autorizado", { status: 401 });

  const [{ data: profile, error: profileError }, rankingCounts, streaks, { data: approvedProfiles }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, avatar_url, nickname_badge, is_setter")
        .eq("id", user.id)
        .maybeSingle(),
      getRankingCounts(supabase),
      getAttendanceStreaks(supabase),
      supabase.from("profiles").select("id").eq("status", "approved"),
    ]);

  if (profileError) return new Response("Não foi possível carregar o perfil", { status: 500 });
  if (!profile) return new Response("Perfil não encontrado", { status: 404 });

  const attendance = rankingCounts.attendance.get(profile.id) ?? 0;
  const wins = rankingCounts.wins.get(profile.id) ?? 0;
  const mvp = rankingCounts.mvp.get(profile.id) ?? 0;
  const performance = rankingCounts.performance.get(profile.id);
  const streak = streaks.get(profile.id) ?? 0;
  const achievementStats = { attendance, wins, mvp, streak, isSetter: profile.is_setter };
  const achievements = getPlayerAchievements(achievementStats);
  const featuredAchievements = getFeaturedAchievements(achievementStats);
  const achievementCount = achievements.filter((achievement) => achievement.unlocked).length;
  const rankings = getPlayerRankingPositions(
    rankingCounts,
    profile.id,
    (approvedProfiles ?? []).map((item) => item.id),
  );
  const logoUrl = new URL("/logo.png", request.url).toString();
  const avatarDataUrl = await imageUrlToDataUrl(profile.avatar_url);

  const stats = [
    { label: "PRESENÇAS", value: String(attendance), rank: rankings.attendance },
    { label: "VITÓRIAS", value: String(wins), rank: rankings.wins },
    { label: "JOGADOR DESTAQUE", value: String(mvp), rank: rankings.mvp },
    {
      label: "APROVEITAMENTO",
      value: performance ? `${performance.percentage}%` : "—",
      rank: rankings.performance,
    },
  ];

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
          padding: "72px 66px 58px",
          color: "white",
          backgroundImage:
            "radial-gradient(circle at 5% 5%, rgba(196,181,253,.38), transparent 27%), radial-gradient(circle at 100% 75%, rgba(124,58,237,.5), transparent 35%), linear-gradient(155deg, #5424a1 0%, #2a135a 48%, #12092c 100%)",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ position: "absolute", right: "-140px", top: "180px", width: "470px", height: "470px", display: "flex", borderRadius: "999px", border: "3px solid rgba(255,255,255,.045)" }} />
        <div style={{ position: "absolute", left: "-170px", bottom: "150px", width: "510px", height: "510px", display: "flex", borderRadius: "999px", border: "3px solid rgba(196,181,253,.055)" }} />

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoUrl} alt="" width={98} height={98} style={{ borderRadius: "23px", objectFit: "cover" }} />
            <div style={{ display: "flex", flexDirection: "column", marginLeft: "22px" }}>
              <span style={{ color: "#ddd6fe", fontSize: "20px", fontWeight: 800, letterSpacing: "4px" }}>VÔLEI POR AMOR</span>
              <span style={{ marginTop: "5px", fontSize: "38px", fontWeight: 900 }}>MEU CARTÃO VPA</span>
            </div>
          </div>
          <span style={{ fontSize: "54px" }}>🏐</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: "42px" }}>
          <div style={{ position: "relative", width: "430px", height: "390px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg viewBox="0 0 512 512" width="430" height="390" style={{ position: "absolute", inset: 0, filter: "drop-shadow(0 0 26px rgba(196,181,253,.36))" }}>
              <path d="M256 466S44 337 44 177C44 91 113 45 181 45c37 0 63 13 75 27 12-14 38-27 75-27 68 0 137 46 137 132 0 160-212 289-212 289Z" fill="rgba(124,58,237,.28)" stroke="#c4b5fd" strokeWidth="17" />
            </svg>
            {avatarDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarDataUrl} alt="" width={244} height={244} style={{ position: "relative", marginTop: "-38px", borderRadius: "999px", objectFit: "cover", border: "9px solid rgba(255,255,255,.92)" }} />
            ) : (
              <span style={{ position: "relative", width: "244px", height: "244px", marginTop: "-38px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "999px", background: "#7c3aed", border: "9px solid rgba(255,255,255,.92)", fontSize: "64px", fontWeight: 900 }}>
                {initials(profile.full_name)}
              </span>
            )}
          </div>

          <span style={{ marginTop: "-16px", maxWidth: "900px", textAlign: "center", fontSize: "56px", fontWeight: 900, lineHeight: 1.05 }}>{profile.full_name}</span>
          {profile.nickname_badge && <span style={{ marginTop: "12px", color: "#ddd6fe", fontSize: "24px", fontWeight: 700 }}>{profile.nickname_badge}</span>}
          <span style={{ marginTop: "13px", color: "rgba(255,255,255,.62)", fontSize: "20px", letterSpacing: "3px" }}>MINHA HISTÓRIA NA QUADRA</span>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", marginTop: "43px" }}>
          {stats.map((stat) => (
            <div key={stat.label} style={{ width: "49.1%", display: "flex", flexDirection: "column", padding: "26px 28px", borderRadius: "24px", background: "rgba(255,255,255,.085)", border: "1px solid rgba(255,255,255,.13)" }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                <span style={{ fontSize: "48px", fontWeight: 900 }}>{stat.value}</span>
                <span style={{ color: "#c4b5fd", fontSize: "17px", fontWeight: 800 }}>{rankLabel(stat.rank)}</span>
              </div>
              <span style={{ marginTop: "8px", color: "rgba(255,255,255,.58)", fontSize: "17px", fontWeight: 700, letterSpacing: "1px" }}>{stat.label}</span>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginTop: "36px", padding: "28px 30px", borderRadius: "26px", background: "rgba(5,2,18,.2)", border: "1px solid rgba(255,255,255,.11)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "22px", fontWeight: 800, letterSpacing: "2px" }}>CONQUISTAS EM DESTAQUE</span>
            <span style={{ color: "#c4b5fd", fontSize: "19px", fontWeight: 700 }}>{achievementCount}/{achievements.length} DESBLOQUEADAS</span>
          </div>
          <div style={{ display: "flex", gap: "13px", marginTop: "22px" }}>
            {featuredAchievements.length ? featuredAchievements.map((achievement) => (
              <div key={achievement.id} style={{ flex: 1, display: "flex", alignItems: "center", padding: "16px 18px", borderRadius: "18px", background: "rgba(196,181,253,.1)", border: "1px solid rgba(196,181,253,.16)" }}>
                <span style={{ fontSize: "31px" }}>{achievement.emoji}</span>
                <span style={{ marginLeft: "11px", fontSize: "17px", fontWeight: 700, lineHeight: 1.15 }}>{achievement.title}</span>
              </div>
            )) : <span style={{ color: "rgba(255,255,255,.55)", fontSize: "21px" }}>A primeira conquista está chegando.</span>}
          </div>
        </div>

        <div style={{ display: "flex", flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "24px", borderTop: "1px solid rgba(255,255,255,.12)", color: "rgba(255,255,255,.62)", fontSize: "18px", letterSpacing: "1px" }}>
          <span>JOGAR, EVOLUIR E COMPARTILHAR 💜</span>
          <span>@volei_por_amor</span>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1920,
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": 'inline; filename="meu-cartao-volei-por-amor.png"',
      },
    },
  );
}
