import { ImageResponse } from "next/og";
import { createClient } from "@/lib/supabase/server";
import { getRankingCounts } from "@/lib/rankings";
import { getSeasonRanking } from "@/lib/seasonRanking";
import { getFeaturedAchievements, getPlayerAchievements, TIER_LABEL, type AchievementTier } from "@/lib/achievements";
import { AvatarFrameArt } from "@/components/AvatarFrameArt";
import { ProfileBannerArt } from "@/components/ProfileBannerArt";
import { expandElements } from "@/lib/expandElements";
import { isBannerId } from "@/lib/cosmetics";
import { isAvatarFrameId } from "@/lib/avatarFrames";
import { badgeStatsFrom, getBadgeCatalog, getEarnedBadges, getProfileExtras } from "@/lib/profileCosmetics";
import type { BadgeColor } from "@/lib/badges";
import { getPlayerRankingPositions } from "@/lib/playerCard";
import { imageUrlToDataUrl } from "@/lib/serverImageData";
import { getActiveCommunity } from "@/lib/community";
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

function rankLabel(position: number | null) {
  return position ? `#${position} NO RANKING` : "SEM POSIÇÃO";
}

const BADGE_COLORS_HEX: Record<BadgeColor, [string, string, string]> = {
  amber: ["#fcd34d", "#d97706", "#fde68a"],
  purple: ["#c084fc", "#7e22ce", "#e9d5ff"],
  sky: ["#7dd3fc", "#0369a1", "#bae6fd"],
  emerald: ["#6ee7b7", "#047857", "#a7f3d0"],
  rose: ["#fda4af", "#be123c", "#fecdd3"],
  fuchsia: ["#f0abfc", "#a21caf", "#f5d0fe"],
  orange: ["#fdba74", "#c2410c", "#fed7aa"],
  slate: ["#e2e8f0", "#475569", "#f1f5f9"],
};

const TIER_HEX: Record<AchievementTier, { bg: string; fg: string }> = {
  bronze: { bg: "#fb923c", fg: "#431407" },
  silver: { bg: "#e2e8f0", fg: "#0f172a" },
  gold: { bg: "#fcd34d", fg: "#451a03" },
  legend: { bg: "#e879f9", fg: "#3b0764" },
};

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return new Response("Não autorizado", { status: 401 });

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, avatar_frame, nickname_badge, is_setter, communities, is_organizer")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) return new Response("Não foi possível carregar o perfil", { status: 500 });
  if (!profile) return new Response("Perfil não encontrado", { status: 404 });

  const community = await getActiveCommunity();
  const [rankingCounts, seasonScores, { data: approvedProfiles }, extras, badgeCatalog, earnedBadges] = await Promise.all([
    getRankingCounts(supabase, community),
    getSeasonRanking(supabase, community),
    supabase.from("profiles").select("id").eq("status", "approved").contains("communities", [community]),
    getProfileExtras(supabase, profile.id),
    getBadgeCatalog(supabase),
    getEarnedBadges(supabase, profile.id),
  ]);

  const attendance = rankingCounts.attendance.get(profile.id) ?? 0;
  const wins = rankingCounts.wins.get(profile.id) ?? 0;
  const mvp = rankingCounts.mvp.get(profile.id) ?? 0;
  const season = seasonScores.get(profile.id);
  const seasonMatches = season ? season.totalWins + season.totalLosses : 0;
  const seasonPercentage = season && seasonMatches > 0 ? Math.round((season.totalWins / seasonMatches) * 100) : null;
  const streak = rankingCounts.streaks.get(profile.id) ?? 0;
  const achievementStats = { attendance, wins, mvp, streak, isSetter: profile.is_setter, ...badgeStatsFrom(earnedBadges, badgeCatalog) };
  const achievements = getPlayerAchievements(achievementStats);
  const featuredAchievements = getFeaturedAchievements(achievementStats);
  const achievementCount = achievements.filter((achievement) => achievement.unlocked).length;
  const rankings = getPlayerRankingPositions(
    rankingCounts,
    seasonScores,
    profile.id,
    (approvedProfiles ?? []).map((item) => item.id),
  );

  // Medalhas em destaque (as escolhidas; se não escolheu, as mais recentes).
  const catalogById = new Map(badgeCatalog.map((badge) => [badge.id, badge]));
  const ownedIds = new Set(earnedBadges.map((item) => item.badge_id));
  const chosen = extras.featured_badges.filter((id) => ownedIds.has(id));
  const shownIds = (chosen.length ? chosen : earnedBadges.map((item) => item.badge_id)).slice(0, 3);
  const shownBadges = shownIds.map((id) => catalogById.get(id)).filter((badge): badge is NonNullable<typeof badge> => Boolean(badge));

  const bannerId = isBannerId(extras.profile_banner) ? extras.profile_banner : "vpa";
  const frameId = isAvatarFrameId(profile.avatar_frame) ? profile.avatar_frame : null;

  const avatarDataUrl = await imageUrlToDataUrl(profile.avatar_url);
  const logos = bannerId.startsWith("logo-")
    ? {
        white: (await imageUrlToDataUrl(new URL("/vpa-nova-logo.png", request.url).toString())) ?? "",
        color: (await imageUrlToDataUrl(new URL("/logo-transparent-v2.png", request.url).toString())) ?? "",
      }
    : undefined;

  const stats = [
    { label: "PRESENÇAS", value: String(attendance), rank: rankings.attendance },
    { label: "VITÓRIAS", value: String(wins), rank: rankings.wins },
    { label: "JOGADOR DESTAQUE", value: String(mvp), rank: rankings.mvp },
    {
      label: "APROVEITAMENTO",
      value: seasonPercentage !== null ? `${seasonPercentage}%` : "—",
      rank: rankings.performance,
    },
  ];

  const PHOTO = 250;
  const FRAME = Math.round(PHOTO * 1.7);
  const CARD_W = 960;
  const BANNER_H = 330;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          backgroundImage:
            "radial-gradient(circle at 12% 8%, rgba(167,139,250,.4), transparent 34%), radial-gradient(circle at 92% 88%, rgba(217,70,239,.3), transparent 38%), linear-gradient(160deg, #3b1a86 0%, #1f0f48 52%, #0d0722 100%)",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            width: `${CARD_W}px`,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            borderRadius: "56px",
            border: "2px solid rgba(255,255,255,.2)",
            backgroundImage: "linear-gradient(180deg, #2a1760 0%, #170c38 100%)",
            boxShadow: "0 30px 90px rgba(0,0,0,.55)",
          }}
        >
          {/* Capa */}
          <div style={{ position: "relative", display: "flex", width: `${CARD_W}px`, height: `${BANNER_H}px`, overflow: "hidden" }}>
            <div style={{ position: "absolute", left: "-60px", top: 0, width: "1080px", height: `${BANNER_H}px`, display: "flex" }}>
              {expandElements(<ProfileBannerArt id={bannerId} logos={logos} />, { width: 1080, height: BANNER_H })}
            </div>
            <div style={{ position: "absolute", left: 0, bottom: 0, width: `${CARD_W}px`, height: "120px", display: "flex", backgroundImage: "linear-gradient(to top, rgba(42,23,96,.95), rgba(42,23,96,0))" }} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", padding: "0 56px 50px" }}>
            {/* Foto + medalhas */}
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: `-${PHOTO / 2 + 14}px` }}>
              <div style={{ position: "relative", display: "flex", width: `${PHOTO + 28}px`, height: `${PHOTO + 28}px`, padding: "14px", borderRadius: "999px", background: "#241352", boxShadow: "0 10px 40px rgba(0,0,0,.45)" }}>
                {avatarDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarDataUrl} alt="" width={PHOTO} height={PHOTO} style={{ borderRadius: "999px", objectFit: "cover" }} />
                ) : (
                  <span style={{ width: `${PHOTO}px`, height: `${PHOTO}px`, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "999px", background: "#7c3aed", fontSize: "80px", fontWeight: 900 }}>
                    {initials(profile.full_name)}
                  </span>
                )}
                {frameId && (
                  <div style={{ position: "absolute", left: `${14 - PHOTO * 0.35}px`, top: `${14 - PHOTO * 0.575}px`, width: `${FRAME}px`, height: `${FRAME}px`, display: "flex" }}>
                    {expandElements(<AvatarFrameArt id={frameId} still />, { width: FRAME, height: FRAME })}
                  </div>
                )}
              </div>

              {shownBadges.length > 0 && (
                <div style={{ display: "flex", gap: "12px", paddingBottom: "6px" }}>
                  {shownBadges.map((badge) => {
                    const [from, to, border] = BADGE_COLORS_HEX[badge.color] ?? BADGE_COLORS_HEX.amber;
                    return (
                      <div key={badge.id} style={{ width: "108px", height: "108px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "28px", border: `3px solid ${border}`, backgroundImage: `linear-gradient(135deg, ${from}, ${to})`, boxShadow: "0 8px 24px rgba(0,0,0,.35)" }}>
                        <span style={{ fontSize: "56px" }}>{badge.emoji}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Nome */}
            <span style={{ marginTop: "26px", maxWidth: "850px", fontSize: "62px", fontWeight: 900, lineHeight: 1.05 }}>{profile.full_name}</span>
            <div style={{ display: "flex", alignItems: "center", marginTop: "14px" }}>
              {profile.nickname_badge && <span style={{ color: "#ddd6fe", fontSize: "26px", fontWeight: 700 }}>{profile.nickname_badge}</span>}
              {profile.is_setter && (
                <span style={{ marginLeft: profile.nickname_badge ? "16px" : 0, padding: "4px 16px", borderRadius: "999px", border: "1px solid rgba(125,211,252,.3)", background: "rgba(125,211,252,.12)", color: "#bae6fd", fontSize: "20px", fontWeight: 700 }}>🏐 Levantador(a)</span>
              )}
            </div>

            {/* Números */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "14px", marginTop: "32px" }}>
              {stats.map((stat) => (
                <div key={stat.label} style={{ width: "48.9%", display: "flex", flexDirection: "column", padding: "22px 26px", borderRadius: "24px", background: "rgba(255,255,255,.085)", border: "1px solid rgba(255,255,255,.13)" }}>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "46px", fontWeight: 900 }}>{stat.value}</span>
                    <span style={{ color: "#c4b5fd", fontSize: "16px", fontWeight: 800 }}>{rankLabel(stat.rank)}</span>
                  </div>
                  <span style={{ marginTop: "6px", color: "rgba(255,255,255,.58)", fontSize: "16px", fontWeight: 700, letterSpacing: "1px" }}>{stat.label}</span>
                </div>
              ))}
            </div>

            {/* Conquistas */}
            <div style={{ display: "flex", flexDirection: "column", marginTop: "28px", padding: "24px 28px", borderRadius: "26px", background: "rgba(5,2,18,.28)", border: "1px solid rgba(255,255,255,.11)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "20px", fontWeight: 800, letterSpacing: "2px" }}>CONQUISTAS EM DESTAQUE</span>
                <span style={{ color: "#c4b5fd", fontSize: "18px", fontWeight: 700 }}>{achievementCount}/{achievements.length} TRILHAS</span>
              </div>
              <div style={{ display: "flex", gap: "12px", marginTop: "18px" }}>
                {featuredAchievements.length ? featuredAchievements.map((achievement) => {
                  const tier = TIER_HEX[achievement.tier];
                  return (
                    <div key={achievement.id} style={{ flex: 1, display: "flex", flexDirection: "column", padding: "14px 16px", borderRadius: "18px", background: "rgba(196,181,253,.1)", border: "1px solid rgba(196,181,253,.16)" }}>
                      <div style={{ display: "flex", alignItems: "center" }}>
                        <span style={{ fontSize: "32px" }}>{achievement.emoji}</span>
                        <span style={{ marginLeft: "10px", padding: "2px 12px", borderRadius: "999px", background: tier.bg, color: tier.fg, fontSize: "14px", fontWeight: 900 }}>{TIER_LABEL[achievement.tier].toUpperCase()}</span>
                      </div>
                      <span style={{ marginTop: "10px", fontSize: "17px", fontWeight: 700, lineHeight: 1.15 }}>{achievement.title.split(" · ")[0]}</span>
                    </div>
                  );
                }) : <span style={{ color: "rgba(255,255,255,.55)", fontSize: "20px" }}>A primeira conquista está chegando.</span>}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "center", marginTop: "30px", color: "rgba(255,255,255,.55)", fontSize: "18px", letterSpacing: "2px" }}>
              <span>{VPA_INSTAGRAM_HANDLE}</span>
            </div>
          </div>
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
