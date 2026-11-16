import type { ReactNode } from "react";

/**
 * Emblemas desenhados (no lugar de emoji) para conquistas e medalhas.
 *  - "hex": conquista (hexágono com aro de metal);
 *  - "medal": medalha de evento/torneio (disco serrilhado com fita).
 * Só SVG puro, sem gradiente com id nem hooks: funciona igual no app e no
 * cartão em imagem (satori), e várias cópias na mesma tela não conflitam.
 */

export type EmblemTone =
  | "bronze" | "silver" | "gold" | "legend" | "locked"
  | "purple" | "sky" | "emerald" | "rose" | "fuchsia";

const TONES: Record<EmblemTone, { rim: string; dark: string; face: string; glyph: string }> = {
  bronze: { rim: "#eca46a", dark: "#8a4a1e", face: "#4e2610", glyph: "#ffe2c4" },
  silver: { rim: "#eef2f8", dark: "#7b8496", face: "#323946", glyph: "#ffffff" },
  gold: { rim: "#ffd86b", dark: "#a8700c", face: "#4f3205", glyph: "#fff1b8" },
  legend: { rim: "#f5b8ff", dark: "#7e22ce", face: "#2e0750", glyph: "#fde68a" },
  locked: { rim: "#4a4470", dark: "#2a2547", face: "#1a1634", glyph: "#7c769c" },
  purple: { rim: "#c9b8ff", dark: "#6d28d9", face: "#26104f", glyph: "#ede9fe" },
  sky: { rim: "#8fdcff", dark: "#0369a1", face: "#0a2a42", glyph: "#e0f2fe" },
  emerald: { rim: "#7ef0c4", dark: "#047857", face: "#05291f", glyph: "#d1fae5" },
  rose: { rim: "#ffadb8", dark: "#be123c", face: "#3f0716", glyph: "#ffe4e6" },
  fuchsia: { rim: "#f5b4ff", dark: "#a21caf", face: "#3d0542", glyph: "#fae8ff" },
};

/** Ícones de traço, grade 24x24. */
const GLYPHS = {
  calendar: <><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4M9 15l2 2 4-4" /></>,
  flame: <path d="M12 2.8c1.2 3.2 5.5 5.2 5.5 10.4a5.5 5.5 0 0 1-11 0c0-2.3 1.1-3.9 2.2-5 0 2.1 1 3.3 2.2 3.4C10.8 8.5 10 5.8 12 2.8Z" />,
  bolt: <path d="M13.5 2 4.5 13.5h7l-1 8.5 9-11.5h-7Z" />,
  trophy: <><path d="M7 3.5h10v5.5a5 5 0 0 1-10 0Z" /><path d="M7 5.5H4a3.5 3.5 0 0 0 3.4 4.4M17 5.5h3a3.5 3.5 0 0 1-3.4 4.4M12 14v3.5M8 21h8M9.5 17.5h5V21h-5Z" /></>,
  medal: <><path d="M8.5 11.5 5.5 3h4.2L12 8.5 14.3 3h4.2l-3 8.5" /><circle cx="12" cy="15.5" r="5.5" /><path d="m12 13 .9 1.8 2 .3-1.4 1.4.3 2-1.8-.9-1.8.9.3-2-1.4-1.4 2-.3Z" /></>,
  rosette: <><circle cx="12" cy="9.5" r="6" /><circle cx="12" cy="9.5" r="2.5" /><path d="M8.6 14.4 7 22l5-2.8 5 2.8-1.6-7.6" /></>,
  setter: <><circle cx="12" cy="6.5" r="3.8" /><path d="M5 21v-4.5l1.6-4.3a1.2 1.2 0 0 1 2.2.2L10 17v4M19 21v-4.5l-1.6-4.3a1.2 1.2 0 0 0-2.2.2L14 17v4" /></>,
  ball: <><circle cx="12" cy="12" r="9" /><path d="M12 12c0-4 2-7 5.2-8.2M12 12c-3.6 2-7 2.2-8.8 1M12 12c2.2 3.4 2.4 6.8 1.6 8.9" /></>,
  shield: <><path d="M12 2.8 19.5 6v5.7c0 4.6-3.1 7.9-7.5 9.5-4.4-1.6-7.5-4.9-7.5-9.5V6Z" /><path d="m8.6 12 2.4 2.4 4.6-4.6" /></>,
  target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.3" /><path d="m15.5 8.5 4-4M17 4.5h2.5V7" /></>,
  users: <><circle cx="9" cy="8" r="3.4" /><path d="M2.8 20c.4-3.6 3-6 6.2-6s5.8 2.4 6.2 6" /><circle cx="17" cy="8.8" r="2.7" /><path d="M16.4 13.8c2.8.3 4.6 2.6 4.9 5.5" /></>,
  weekend: <><circle cx="8" cy="9" r="3" /><path d="M8 3v1.4M8 13.6V15M2 9h1.4M12.6 9H14M3.8 4.8l1 1M11.2 12.2l1 1M3.8 13.2l1-1M11.2 5.8l1-1" /><path d="M21 16.4A5 5 0 1 1 15.6 10a4 4 0 0 0 5.4 6.4Z" /></>,
  star: <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z" />,
  crown: <><path d="m3 8 4.2 4L12 5l4.8 7L21 8l-2 10.5H5Z" /><path d="M5 21h14" /></>,
  heart: <path d="M12 20.3s-7.5-4.6-7.5-10.4A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.7c0 5.8-7.5 10.4-7.5 10.4Z" />,
  flask: <path d="M9 3h6M10 3v6.2L4.8 18a2 2 0 0 0 1.7 3h11a2 2 0 0 0 1.7-3L14 9.2V3M7.6 14.5h8.8" />,
  party: <path d="m3.5 20.5 4.3-11.3 7 7Zm9.8-15.8.8 2M19.5 5.5l-2 1.2M20.5 11h-2.2M14.5 3.5c1 1.6.3 3-.6 4M18 9.5c-1.6-.4-3 .3-3.7 1.3" />,
  wrench: <path d="M15.2 3.4a5 5 0 0 0-4.6 6.9L3.6 17.3v3.1h3.1l7-7a5 5 0 0 0 6.9-4.6l-3 1.2-2.4-2.4Z" />,
  gem: <path d="M3 9.2 6.2 4h11.6L21 9.2 12 20.5Zm0 0h18M12 20.5 8.6 9.2 10.2 4M12 20.5l3.4-11.3L13.8 4" />,
  rise: <><path d="m3 17 6-6 4 4 8-8" /><path d="M15 7h6v6" /></>,
  rocket: <><path d="M12 3c4 2.2 5.5 6.5 4.6 11.2h-9.2C6.5 9.5 8 5.2 12 3Z" /><circle cx="12" cy="9.5" r="1.8" /><path d="M7.4 14.2 5 18l3.4-.6M16.6 14.2 19 18l-3.4-.6M10.5 18.5 12 21l1.5-2.5" /></>,
} satisfies Record<string, ReactNode>;

export type GlyphId = keyof typeof GLYPHS;
export const GLYPH_IDS = Object.keys(GLYPHS) as GlyphId[];
export const isGlyphId = (value: unknown): value is GlyphId => typeof value === "string" && value in GLYPHS;

/** Medalhas antigas guardam um emoji: aqui vira o ícone desenhado equivalente. */
const EMOJI_GLYPH: Record<string, GlyphId> = {
  "🏆": "trophy", "🥇": "medal", "🥈": "medal", "🥉": "medal", "🏅": "medal", "🎖️": "rosette", "🎖": "rosette",
  "🌟": "star", "⭐": "star", "✨": "star", "💜": "heart", "❤️": "heart", "❤": "heart", "🧪": "flask", "🎉": "party",
  "🛠️": "wrench", "🛠": "wrench", "👑": "crown", "🏐": "ball", "🔥": "flame", "⚡": "bolt", "💎": "gem", "🚀": "rocket",
  "📅": "calendar", "✌️": "bolt", "💪": "flame", "🪄": "setter",
};

/** Ícone de uma medalha: "icon:trophy" (novo) ou emoji antigo convertido. */
export function badgeGlyph(emoji: string | null | undefined): GlyphId {
  if (!emoji) return "medal";
  if (emoji.startsWith("icon:")) {
    const id = emoji.slice(5);
    return isGlyphId(id) ? id : "medal";
  }
  return EMOJI_GLYPH[emoji.trim()] ?? "star";
}

const HEX = "M32 3 57 17.5v29L32 61 7 46.5v-29Z";
const HEX_IN = "M32 9.5 51.4 20.7v22.6L32 54.5 12.6 43.3V20.7Z";

function Glyph({ id, color, scale = 1.28, cy = 32 }: { id: GlyphId; color: string; scale?: number; cy?: number }) {
  const t = `translate(${32 - 12 * scale} ${cy - 12 * scale}) scale(${scale})`;
  return (
    <>
      <g transform={`translate(0 1.2) ${t}`} fill="none" stroke="#000" strokeOpacity=".35" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">{GLYPHS[id]}</g>
      <g transform={t} fill="none" stroke={color} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">{GLYPHS[id]}</g>
    </>
  );
}

export function AchievementEmblem({
  glyph,
  tone,
  size = 48,
  shape = "hex",
}: {
  glyph: GlyphId;
  tone: EmblemTone;
  size?: number;
  shape?: "hex" | "medal";
}) {
  const c = TONES[tone];
  const shine = tone === "legend" || tone === "gold";
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden focusable="false" style={{ display: "block", flexShrink: 0 }}>
      {shape === "hex" ? (
        <>
          <path d={HEX} fill={c.dark} transform="translate(0 1.6)" />
          <path d={HEX} fill={c.rim} />
          <path d="M32 3 57 17.5v14.5H7V17.5Z" fill="#fff" opacity=".22" />
          <path d={HEX_IN} fill={c.dark} transform="translate(0 -.8)" />
          <path d={HEX_IN} fill={c.face} />
          <path d="M32 9.5 51.4 20.7V30H12.6v-9.3Z" fill="#fff" opacity=".07" />
          {tone === "legend" && <path d={HEX} fill="none" stroke="#fde68a" strokeWidth="1.2" opacity=".85" />}
          <Glyph id={glyph} color={c.glyph} />
        </>
      ) : (
        <>
          <path d="M20 40 14 62l7-4 4 6 5-20ZM44 40l6 22-7-4-4 6-5-20Z" fill={c.dark} />
          <path d="M20 40 15.5 58l5.5-3 3.4 4.6L28 43ZM44 40l4.5 18-5.5-3-3.4 4.6L36 43Z" fill={c.rim} opacity=".55" />
          {Array.from({ length: 18 }, (_, i) => {
            const a = (i / 18) * Math.PI * 2;
            return <circle key={i} cx={Math.round((32 + Math.cos(a) * 24.5) * 10) / 10} cy={Math.round((28 + Math.sin(a) * 24.5) * 10) / 10} r="3.2" fill={c.dark} />;
          })}
          <circle cx="32" cy="28" r="24.5" fill={c.dark} />
          <circle cx="32" cy="27" r="23.5" fill={c.rim} />
          <path d="M8.6 26a23.5 23.5 0 0 1 46.8 0Z" fill="#fff" opacity=".22" />
          <circle cx="32" cy="28" r="18.5" fill={c.dark} />
          <circle cx="32" cy="28.6" r="17.6" fill={c.face} />
          <Glyph id={glyph} color={c.glyph} scale={1.1} cy={28.6} />
        </>
      )}
      {shine && (
        <>
          <path d="M51 6.5c.4 2.3 1.2 3.1 3.5 3.5-2.3.4-3.1 1.2-3.5 3.5-.4-2.3-1.2-3.1-3.5-3.5 2.3-.4 3.1-1.2 3.5-3.5Z" fill="#fff" />
          <path d="M11 47c.3 1.5.8 2 2.3 2.3-1.5.3-2 .8-2.3 2.3-.3-1.5-.8-2-2.3-2.3 1.5-.3 2-.8 2.3-2.3Z" fill="#fff" opacity=".8" />
        </>
      )}
    </svg>
  );
}

/** Cor da medalha (badges.color) → tom do emblema. */
export function badgeTone(color: string): EmblemTone {
  if (color === "amber") return "gold";
  if (color === "slate") return "silver";
  if (color === "orange") return "bronze";
  if (color === "purple" || color === "sky" || color === "emerald" || color === "rose" || color === "fuchsia") return color;
  return "gold";
}
