import { ImageResponse } from "next/og";
import { VPA_INSTAGRAM_HANDLE } from "@/lib/brand";

export type ReceiptImageData = {
  fullName: string;
  avatar: string | null;
  day: string;
  time: string | null;
  location: string | null;
  paid: boolean;
  rows: [string, string][];
  logoUrl: string;
  generatedAt: string;
};

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

/** Arte do comprovante "Minha vaga" (1080x1350, retrato: bom pra galeria e WhatsApp). */
export function renderReceiptImage({ fullName, avatar, day, time, location, paid, rows, logoUrl, generatedAt }: ReceiptImageData) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "64px 64px 52px",
          color: "white",
          fontFamily: "sans-serif",
          backgroundImage:
            "radial-gradient(circle at 0% 0%, rgba(167,139,250,.45), transparent 35%), radial-gradient(circle at 100% 100%, rgba(52,211,153,.22), transparent 40%), linear-gradient(160deg, #5424a1 0%, #2a135a 55%, #12092c 100%)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoUrl} alt="" width={170} height={141} style={{ objectFit: "contain" }} />
          <div style={{ display: "flex", alignItems: "center", padding: "14px 26px", borderRadius: "999px", background: paid ? "rgba(52,211,153,.22)" : "rgba(251,191,36,.22)", border: `2px solid ${paid ? "rgba(110,231,183,.6)" : "rgba(252,211,77,.6)"}`, color: paid ? "#d1fae5" : "#fef3c7", fontSize: "28px", fontWeight: 800, letterSpacing: "2px" }}>
            {paid ? "✓ VAGA GARANTIDA" : "FALTA PAGAR"}
          </div>
        </div>

        <span style={{ marginTop: "40px", color: "#c4b5fd", fontSize: "26px", fontWeight: 800, letterSpacing: "5px" }}>COMPROVANTE · MINHA VAGA</span>

        <div style={{ display: "flex", alignItems: "center", marginTop: "26px" }}>
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} alt="" width={150} height={150} style={{ borderRadius: "999px", objectFit: "cover", border: "6px solid rgba(255,255,255,.9)" }} />
          ) : (
            <span style={{ width: "150px", height: "150px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "999px", background: "#7c3aed", border: "6px solid rgba(255,255,255,.9)", fontSize: "52px", fontWeight: 900 }}>
              {initials(fullName)}
            </span>
          )}
          <div style={{ display: "flex", flexDirection: "column", marginLeft: "32px", flex: 1 }}>
            <span style={{ fontSize: "56px", fontWeight: 900, lineHeight: 1.05 }}>{fullName}</span>
            <span style={{ marginTop: "12px", fontSize: "30px", color: "rgba(255,255,255,.75)", textTransform: "capitalize" }}>
              {`${day}${time ? ` · ${time.slice(0, 5)}` : ""}`}
            </span>
            {location && <span style={{ marginTop: "6px", fontSize: "28px", color: "rgba(255,255,255,.6)" }}>{`📍 ${location}`}</span>}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginTop: "44px", padding: "18px 36px", borderRadius: "32px", background: "rgba(255,255,255,.08)", border: "2px solid rgba(255,255,255,.14)" }}>
          {rows.map(([label, value], index) => (
            <div key={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 0", borderTop: index ? "2px dashed rgba(255,255,255,.14)" : "none" }}>
              <span style={{ fontSize: "30px", color: "rgba(255,255,255,.6)" }}>{label}</span>
              <span style={{ fontSize: label === "Código" ? "26px" : "34px", fontWeight: 800, maxWidth: "560px", textAlign: "right" }}>{value}</span>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "22px", borderTop: "2px solid rgba(255,255,255,.12)", color: "rgba(255,255,255,.55)", fontSize: "22px" }}>
          <span>{`Gerado em ${generatedAt} · rachavoleiporamor.com.br`}</span>
          <span>{VPA_INSTAGRAM_HANDLE}</span>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1350,
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": 'inline; filename="minha-vaga-volei-por-amor.png"',
      },
    },
  );
}
