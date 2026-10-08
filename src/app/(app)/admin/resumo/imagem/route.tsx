import { ImageResponse } from "next/og";
import { requireOrganizer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getActiveCommunity } from "@/lib/community";
import { getMonthlyReport, normalizeMonthKey, type MonthlyReportMetric, type MonthlyReportPlayer } from "@/lib/monthlyReport";
import { embedAvatarUrls } from "@/lib/serverImageData";
import { VPA_INSTAGRAM_HANDLE } from "@/lib/brand";

export const dynamic = "force-dynamic";

const ART_IDS = ["overview", "performance", "wins", "mvp", "attendance"] as const;
type ArtId = (typeof ART_IDS)[number];

const CONFIG: Record<MonthlyReportMetric, { title: string; kicker: string; color: string }> = {
  performance: { title: "APROVEITAMENTO", kicker: "Quem mais transformou jogos em vitórias", color: "#67e8f9" },
  wins: { title: "MAIS VITÓRIAS", kicker: "Cada resultado registrado no mês", color: "#fde68a" },
  mvp: { title: "JOGADORES DESTAQUE", kicker: "Quem brilhou nos rachas do mês", color: "#f9a8d4" },
  attendance: { title: "PRESENÇA VPA", kicker: "Quem esteve com a gente no mês", color: "#86efac" },
};

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

function metricValue(metric: MonthlyReportMetric, player: MonthlyReportPlayer) {
  if (metric === "performance") return player.percentage === null ? "—" : `${player.percentage}%`;
  if (metric === "wins") return String(player.wins);
  if (metric === "mvp") return String(player.mvp);
  return String(player.attendance);
}

function metricDetail(metric: MonthlyReportMetric, player: MonthlyReportPlayer) {
  if (metric === "performance") return player.matches ? `${player.performanceWins}V · ${player.losses}D · ${player.matches} jogos` : "sem confrontos registrados";
  if (metric === "wins") return player.percentage === null ? `${player.matches} jogos` : `${player.matches} jogos · ${player.percentage}% aprov.`;
  if (metric === "mvp") return `${player.attendance} presenças`;
  return `${player.wins} vitórias · ${player.mvp} destaques`;
}

function baseStyle(community: "court" | "sand") {
  return {
    width: "100%",
    height: "100%",
    boxSizing: "border-box" as const,
    display: "flex",
    flexDirection: "column" as const,
    position: "relative" as const,
    overflow: "hidden",
    padding: "90px 64px 66px",
    color: "white",
    backgroundImage: community === "sand"
      ? "radial-gradient(circle at 90% 4%, rgba(251,191,36,.28), transparent 30%), radial-gradient(circle at 3% 92%, rgba(34,211,238,.22), transparent 34%), linear-gradient(155deg, #4a2871 0%, #211743 48%, #0b1732 100%)"
      : "radial-gradient(circle at 90% 4%, rgba(167,139,250,.42), transparent 30%), radial-gradient(circle at 3% 92%, rgba(37,99,235,.26), transparent 34%), linear-gradient(155deg, #48218a 0%, #211044 48%, #090d25 100%)",
    fontFamily: "sans-serif",
  };
}

function Header({ logoUrl, title, subtitle, communityLabel }: { logoUrl: string; title: string; subtitle: string; communityLabel: string }) {
  return (
    <div style={{ height: "126px", flexShrink: 0, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
      <div style={{ display: "flex", alignItems: "center" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoUrl} alt="" width={88} height={88} style={{ borderRadius: "23px", objectFit: "cover" }} />
        <div style={{ display: "flex", flexDirection: "column", marginLeft: "20px" }}>
          <span style={{ fontSize: "18px", fontWeight: 800, letterSpacing: "4px", color: "#ddd6fe" }}>VÔLEI POR AMOR · {communityLabel.toUpperCase()}</span>
          <span style={{ marginTop: "5px", fontSize: "44px", lineHeight: 1, fontWeight: 900 }}>{title}</span>
        </div>
      </div>
      <div style={{ width: "82px", height: "82px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "25px", background: "rgba(255,255,255,.09)", border: "1px solid rgba(255,255,255,.14)", fontSize: "42px" }}>🏐</div>
      <span style={{ position: "absolute", left: "66px", top: "194px", fontSize: "20px", color: "rgba(255,255,255,.55)" }}>{subtitle}</span>
    </div>
  );
}

function Footer() {
  return <div style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "22px", borderTop: "1px solid rgba(255,255,255,.12)", color: "rgba(255,255,255,.55)", fontSize: "16px", letterSpacing: "1px" }}><span>UM MÊS DE JOGO, RESENHA E EVOLUÇÃO</span><span>{VPA_INSTAGRAM_HANDLE}</span></div>;
}

function OverviewArt({ report, logoUrl }: { report: Awaited<ReturnType<typeof getMonthlyReport>>; logoUrl: string }) {
  const communityLabel = report.community === "sand" ? "Areia" : "Quadra";
  return (
    <div style={baseStyle(report.community)}>
      <div style={{ position: "absolute", right: "-160px", top: "320px", width: "480px", height: "480px", display: "flex", borderRadius: "999px", border: "3px solid rgba(255,255,255,.04)" }} />
      <Header logoUrl={logoUrl} title="RESUMO DO MÊS" subtitle={`${report.monthLabel} · ciclo completo com ${report.finishedEvents.length} rachas`} communityLabel={communityLabel} />

      <div style={{ minHeight: 0, display: "flex", flex: 1, flexDirection: "column", justifyContent: "center" }}>
        <div style={{ display: "flex", gap: "12px", marginTop: "54px" }}>
          {[
            [report.finishedEvents.length, "rachas"],
            [report.players.length, "jogadores"],
            [report.totalMatches, "resultados"],
            [report.averageAttendance.toFixed(1), "média por racha"],
          ].map(([value, label]) => <div key={label} style={{ flex: 1, display: "flex", flexDirection: "column", padding: "20px", borderRadius: "22px", background: "rgba(255,255,255,.075)", border: "1px solid rgba(255,255,255,.11)" }}><span style={{ fontSize: "34px", fontWeight: 900 }}>{value}</span><span style={{ marginTop: "5px", fontSize: "14px", color: "rgba(255,255,255,.55)", textTransform: "uppercase", letterSpacing: "1px" }}>{label}</span></div>)}
        </div>

        <div style={{ display: "flex", alignItems: "center", marginTop: "38px", marginBottom: "16px" }}><span style={{ fontSize: "28px" }}>✨</span><span style={{ marginLeft: "11px", fontSize: "25px", fontWeight: 900 }}>Os nomes do mês</span></div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "14px" }}>
          {(Object.keys(CONFIG) as MonthlyReportMetric[]).map((metric) => {
            const config = CONFIG[metric];
            const leaders = report.rankings[metric].slice(0, 3);
            return <div key={metric} style={{ width: "49.2%", display: "flex", flexDirection: "column", padding: "24px", borderRadius: "25px", background: "rgba(8,5,30,.28)", border: "1px solid rgba(255,255,255,.1)" }}>
              <span style={{ fontSize: "15px", fontWeight: 900, color: config.color, letterSpacing: "2px" }}>{config.title}</span>
              <div style={{ display: "flex", flexDirection: "column", marginTop: "14px" }}>
                {leaders.map((player, index) => <div key={player.profileId} style={{ display: "flex", alignItems: "center", height: "57px", borderBottom: "1px solid rgba(255,255,255,.06)" }}><span style={{ width: "28px", height: "28px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "999px", background: index === 0 ? config.color : "rgba(255,255,255,.1)", color: index === 0 ? "#241447" : "white", fontSize: "13px", fontWeight: 900 }}>{index + 1}</span><span style={{ maxWidth: "300px", marginLeft: "11px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "17px", fontWeight: 750 }}>{player.fullName}</span><span style={{ marginLeft: "auto", color: config.color, fontSize: "20px", fontWeight: 900 }}>{metricValue(metric, player)}</span></div>)}
              </div>
            </div>;
          })}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: "42px" }}><span style={{ fontSize: "50px", fontWeight: 900, letterSpacing: "7px", color: "rgba(221,214,254,.33)" }}>MÊS FECHADO</span><span style={{ marginTop: "8px", fontSize: "18px", color: "rgba(255,255,255,.48)", letterSpacing: "2px" }}>CADA JOGO CONTA UMA PARTE DA NOSSA HISTÓRIA 💜</span></div>
      </div>
      <Footer />
    </div>
  );
}

function RankingArt({ report, metric, logoUrl }: { report: Awaited<ReturnType<typeof getMonthlyReport>>; metric: MonthlyReportMetric; logoUrl: string }) {
  const config = CONFIG[metric];
  const players = report.rankings[metric];
  const leaders = players.slice(0, 3);
  const rows = players.length > 20 ? Math.ceil(players.length / 2) : players.length;
  const columns = players.length > 20 ? [players.slice(0, rows), players.slice(rows)] : [players];
  const rowHeight = Math.max(38, Math.min(58, Math.floor(1010 / Math.max(rows, 1))));
  const communityLabel = report.community === "sand" ? "Areia" : "Quadra";

  return (
    <div style={baseStyle(report.community)}>
      <Header logoUrl={logoUrl} title={config.title} subtitle={`${report.monthLabel} · ranking mensal completo`} communityLabel={communityLabel} />
      <div style={{ minHeight: 0, display: "flex", flex: 1, flexDirection: "column", justifyContent: "flex-start" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: "20px", marginTop: "50px" }}>
          {[leaders[1], leaders[0], leaders[2]].map((player, slot) => player ? <div key={player.profileId} style={{ width: slot === 1 ? "30%" : "25%", display: "flex", flexDirection: "column", alignItems: "center", padding: slot === 1 ? "25px 16px" : "19px 14px", borderRadius: "26px", background: slot === 1 ? "rgba(255,255,255,.12)" : "rgba(255,255,255,.07)", border: slot === 1 ? `2px solid ${config.color}` : "1px solid rgba(255,255,255,.1)" }}>
            {player.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={player.avatarUrl} alt="" width={slot === 1 ? 92 : 72} height={slot === 1 ? 92 : 72} style={{ borderRadius: "999px", objectFit: "cover", border: `3px solid ${config.color}` }} />
            ) : <span style={{ width: slot === 1 ? "92px" : "72px", height: slot === 1 ? "92px" : "72px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "999px", background: "rgba(124,58,237,.45)", border: `3px solid ${config.color}`, fontSize: "25px", fontWeight: 900 }}>{initials(player.fullName)}</span>}
            <span style={{ marginTop: "10px", maxWidth: "240px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: slot === 1 ? "22px" : "18px", fontWeight: 900 }}>{player.fullName}</span>
            <span style={{ marginTop: "5px", color: config.color, fontSize: slot === 1 ? "31px" : "24px", fontWeight: 900 }}>{metricValue(metric, player)}</span>
            <span style={{ fontSize: "13px", color: "rgba(255,255,255,.48)" }}>{metricDetail(metric, player)}</span>
          </div> : <div key={slot} style={{ width: "25%", display: "flex" }} />)}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "26px", marginBottom: "12px" }}><span style={{ fontSize: "20px", fontWeight: 900 }}>{config.kicker}</span><span style={{ color: "rgba(255,255,255,.45)", fontSize: "14px" }}>{players.length} jogadores</span></div>
        <div style={{ display: "flex", gap: "14px" }}>
          {columns.map((column, columnIndex) => <div key={columnIndex} style={{ width: columns.length === 1 ? "100%" : "49.3%", display: "flex", flexDirection: "column", padding: "8px 16px", borderRadius: "22px", background: "rgba(5,3,22,.24)", border: "1px solid rgba(255,255,255,.09)" }}>
            {column.map((player) => {
              const position = players.indexOf(player) + 1;
              return <div key={player.profileId} style={{ minWidth: 0, display: "flex", alignItems: "center", height: `${rowHeight}px`, borderBottom: "1px solid rgba(255,255,255,.055)" }}><span style={{ width: "30px", flexShrink: 0, color: position <= 3 ? config.color : "rgba(255,255,255,.42)", fontSize: "14px", fontWeight: 900 }}>{position}º</span><span style={{ width: "30px", height: "30px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "999px", background: "rgba(124,58,237,.38)", color: "#ede9fe", fontSize: "10px", fontWeight: 900 }}>{initials(player.fullName)}</span><span style={{ minWidth: 0, maxWidth: columns.length === 1 ? "610px" : "260px", marginLeft: "9px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: rows > 25 ? "14px" : "17px", fontWeight: 700 }}>{player.fullName}</span><div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", marginLeft: "auto" }}><span style={{ color: config.color, fontSize: rows > 25 ? "16px" : "19px", fontWeight: 900 }}>{metricValue(metric, player)}</span>{rowHeight >= 50 && <span style={{ fontSize: "10px", color: "rgba(255,255,255,.38)" }}>{metricDetail(metric, player)}</span>}</div></div>;
            })}
          </div>)}
        </div>
      </div>
      <Footer />
    </div>
  );
}

function renderMonthlyArt(
  report: Awaited<ReturnType<typeof getMonthlyReport>>,
  art: ArtId,
  logoUrl: string,
) {
  return new ImageResponse(
    art === "overview" ? <OverviewArt report={report} logoUrl={logoUrl} /> : <RankingArt report={report} metric={art} logoUrl={logoUrl} />,
    { width: 1080, height: 1920 },
  );
}

export async function GET(request: Request) {
  const profile = await requireOrganizer();
  const supabase = await createClient();
  const community = await getActiveCommunity(profile);
  const url = new URL(request.url);
  const monthKey = normalizeMonthKey(url.searchParams.get("month"));
  const requestedArt = url.searchParams.get("art");
  const art: ArtId = ART_IDS.includes(requestedArt as ArtId) ? requestedArt as ArtId : "overview";
  const report = await getMonthlyReport(supabase, community, monthKey);
  if (!report.unlocked) return new Response("A análise mensal será liberada depois de quatro rachas encerrados.", { status: 409 });

  if (art !== "overview") {
    const embedded = await embedAvatarUrls(report.rankings[art].slice(0, 3));
    const avatarById = new Map(embedded.map((player) => [player.profileId, player.avatarUrl]));
    report.rankings[art] = report.rankings[art].map((player) => ({ ...player, avatarUrl: avatarById.get(player.profileId) ?? null }));
  }

  const logoUrl = new URL("/logo.png", request.url).toString();
  const image = renderMonthlyArt(report, art, logoUrl);
  image.headers.set("Cache-Control", "private, no-store");
  image.headers.set("Content-Disposition", `inline; filename="vpa-resumo-${monthKey}-${art}.png"`);
  return image;
}
