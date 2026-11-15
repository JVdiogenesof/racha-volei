import type { ReactNode } from "react";
import type { BannerId } from "@/lib/cosmetics";

/**
 * Capas do cartão de perfil, em SVG 600x200 (corta nas bordas conforme a tela).
 *
 * Composição: a foto cobre o canto de baixo à esquerda (x < 200, y > 110) e a
 * base do banner escurece pra cor do cartão. Por isso o assunto principal de
 * cada capa fica do centro pra direita, entre y 20 e 130. Na busca de jogadores
 * aparece só o miolo (x 200 a 400), então ele também precisa ter algo.
 *
 * Tudo é determinístico (igual no servidor e no navegador) e sem `style`: o
 * cartão em imagem (satori) desenha exatamente o mesmo SVG.
 */

/** Logos (a branca serve em fundo escuro; a azul/branca, em fundo claro). Na imagem do cartão, vêm como data URL. */
export type BannerLogos = { white: string; color: string };
export const DEFAULT_LOGOS: BannerLogos = { white: "/vpa-nova-logo.png", color: "/logo-transparent-v2.png" };

/** Pseudo-aleatório determinístico. */
function rand(seed: number) {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}
const r1 = (n: number) => Math.round(n * 10) / 10;
type Pt = [number, number];
const poly = (pts: Pt[]) => `M${pts.map(([x, y]) => `${x} ${y}`).join("L")}`;

/* ───────────────────────── peças compartilhadas ───────────────────────── */

function SharedDefs() {
  return (
    <defs>
      {/* Grão de impressão: quebra o aspecto de vetor chapado. */}
      <filter id="pb-grain" filterUnits="userSpaceOnUse" x="0" y="0" width="600" height="200">
        <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="1" seed="4" stitchTiles="stitch" result="n" />
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 1.6 0 0 0 -.92" result="w" />
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -1.6 0 0 0 .7" result="b" />
        <feMerge><feMergeNode in="w" /><feMergeNode in="b" /></feMerge>
      </filter>
      <filter id="pb-soft" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="2.2" /></filter>
      <filter id="pb-blur" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="10" /></filter>
      <filter id="pb-glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="2.6" result="b" />
        <feMerge><feMergeNode in="b" /><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
      <filter id="pb-drop" x="-30%" y="-30%" width="160%" height="170%">
        <feGaussianBlur in="SourceAlpha" stdDeviation="3.2" />
        <feOffset dy="5" result="o" />
        <feColorMatrix in="o" type="matrix" values="0 0 0 0 .06 0 0 0 0 .02 0 0 0 0 .16 0 0 0 .6 0" result="s" />
        <feMerge><feMergeNode in="s" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
      <radialGradient id="pb-vig" cx=".5" cy=".42" r=".72"><stop offset=".55" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity="1" /></radialGradient>
      <radialGradient id="pb-ball-shade" cx=".34" cy=".28" r=".85">
        <stop offset="0" stopColor="#fff" stopOpacity=".5" />
        <stop offset=".42" stopColor="#fff" stopOpacity="0" />
        <stop offset="1" stopColor="#120a32" stopOpacity=".6" />
      </radialGradient>
      <linearGradient id="pb-cloud" gradientUnits="userSpaceOnUse" x1="0" y1="-40" x2="0" y2="4"><stop offset=".3" stopColor="#fff" /><stop offset="1" stopColor="#b9cbe8" /></linearGradient>
      <clipPath id="pb-cloud-clip"><rect x="-70" y="-60" width="140" height="64" /></clipPath>
      <clipPath id="pb-ball-clip"><circle r="10" /></clipPath>
      <pattern id="pb-mesh" width="5" height="5" patternUnits="userSpaceOnUse"><path d="M0 .3H5M.3 0V5" stroke="#fff" strokeWidth=".55" fill="none" /></pattern>
      <pattern id="pb-mesh-dark" width="5" height="5" patternUnits="userSpaceOnUse"><path d="M0 .3H5M.3 0V5" stroke="#12062a" strokeWidth=".8" fill="none" /></pattern>
    </defs>
  );
}

function Grain({ opacity = 0.45 }: { opacity?: number }) {
  return <rect width="600" height="200" fill="#000" filter="url(#pb-grain)" opacity={opacity} />;
}

function Vignette({ opacity = 0.45 }: { opacity?: number }) {
  return <rect width="600" height="200" fill="url(#pb-vig)" opacity={opacity} />;
}

/*
 * Gomos da bola: três costuras em espiral saindo do centro e chegando quase
 * tangentes à borda (o desenho clássico de bola de vôlei, não de bola de praia).
 * Cada gomo tem mais duas costuras finas: as três tiras de cada painel.
 */
const SEAM: [Pt, Pt, Pt, Pt] = [[0, 0], [6.2, 0.4], [8.2, -6.4], [0, -10]];
function rotPt([x, y]: Pt, deg: number): Pt {
  const a = (deg * Math.PI) / 180;
  return [r1(x * Math.cos(a) - y * Math.sin(a)), r1(x * Math.sin(a) + y * Math.cos(a))];
}
function seamPoints(deg: number, from: number): Pt[] {
  const [p0, p1, p2, p3] = SEAM.map((p) => rotPt(p, deg));
  return Array.from({ length: 12 }, (_, i) => {
    const t = from + ((1 - from) * i) / 11;
    const u = 1 - t;
    return [r1(u ** 3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t ** 3 * p3[0]), r1(u ** 3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t ** 3 * p3[1])] as Pt;
  });
}
const BALL_PANELS = [0, 1, 2].map((k) => {
  const s = SEAM.map((p) => rotPt(p, k * 120));
  const t = SEAM.map((p) => rotPt(p, (k + 1) * 120));
  return {
    d: `M0 0C${s[1].join(" ")} ${s[2].join(" ")} ${s[3].join(" ")}A10 10 0 0 1 ${t[3].join(" ")}C${t[2].join(" ")} ${t[1].join(" ")} 0 0Z`,
    seams: [poly(seamPoints(k * 120 + 40, 0.22)), poly(seamPoints(k * 120 + 80, 0.22))],
  };
});

/** Bola de vôlei: gomos em espiral azul e amarelo, sombra e brilho. */
function Volleyball({ x, y, r, rot = 0, tint }: { x: number; y: number; r: number; rot?: number; tint?: string }) {
  const panels = tint ? [tint, "#efeaff", tint] : ["#1f56d6", "#ffc928", "#f7f4ec"];
  return (
    <g transform={`translate(${x} ${y}) scale(${r1(r / 10)})`}>
      <circle r="10" fill="#f7f4ec" />
      <g transform={`rotate(${rot})`} clipPath="url(#pb-ball-clip)">
        {BALL_PANELS.map((panel, k) => (
          <g key={k}>
            <path d={panel.d} fill={panels[k]} />
            {panel.seams.map((d) => <path key={d} d={d} fill="none" stroke="#0f1446" strokeOpacity=".3" strokeWidth=".4" />)}
          </g>
        ))}
        {BALL_PANELS.map((panel, k) => <path key={k} d={panel.d} fill="none" stroke="#0f1446" strokeOpacity=".5" strokeWidth=".55" />)}
      </g>
      <circle r="10" fill="url(#pb-ball-shade)" />
      <ellipse cx="-3.9" cy="-4.7" rx="2.6" ry="1.4" transform="rotate(-38 -3.9 -4.7)" fill="#fff" opacity=".6" />
      <circle r="10" fill="none" stroke="#120a2e" strokeOpacity=".5" strokeWidth=".6" />
    </g>
  );
}

/** Sombra no chão. */
function FloorShadow({ x, y, rx, opacity = 0.35 }: { x: number; y: number; rx: number; opacity?: number }) {
  return <ellipse cx={x} cy={y} rx={rx} ry={r1(rx * 0.22)} fill="#0b0420" opacity={opacity} filter="url(#pb-soft)" />;
}

/** Rastro de movimento atrás da bola (arco tracejado que some). */
function Trail({ d, color = "#fff", opacity = 0.5 }: { d: string; color?: string; opacity?: number }) {
  return (
    <g fill="none" stroke={color} strokeLinecap="round">
      <path d={d} strokeWidth="3" opacity={opacity * 0.35} strokeDasharray="1 7" />
      <path d={d} strokeWidth="1.2" opacity={opacity} strokeDasharray="10 6" />
    </g>
  );
}

const POSES: Record<"spike" | "block" | "set", { head: Pt; torso: [Pt, Pt]; arms: Pt[][]; legs: Pt[][] }> = {
  spike: {
    head: [7, -31],
    torso: [[0, 0], [4, -22]],
    arms: [[[4, -22], [9, -34], [13, -45]], [[4, -22], [12, -22], [19, -18]]],
    legs: [[[0, 0], [7, 9], [1, 19]], [[0, 0], [-3, 11], [-12, 14]]],
  },
  block: {
    head: [0, -31],
    torso: [[0, 0], [0, -22]],
    arms: [[[0, -22], [8, -32], [10, -45]], [[0, -22], [-8, -32], [-10, -45]]],
    legs: [[[0, 0], [5, 12], [4, 24]], [[0, 0], [-5, 12], [-4, 24]]],
  },
  set: {
    head: [2, -31],
    torso: [[0, 0], [1, -22]],
    arms: [[[1, -22], [7, -30], [6, -40]], [[1, -22], [-5, -30], [-2, -40]]],
    legs: [[[0, 0], [6, 11], [5, 23]], [[0, 0], [-5, 11], [-7, 23]]],
  },
};

/** Atleta em pictograma (estilo placa olímpica): membros em traço arredondado. */
function Athlete({ x, y, s = 1, color, pose = "spike", flip = false }: { x: number; y: number; s?: number; color: string; pose?: keyof typeof POSES; flip?: boolean }) {
  const p = POSES[pose];
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`} fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round">
      {p.legs.map((leg, i) => <path key={`l${i}`} d={poly(leg)} strokeWidth="5.4" />)}
      <path d={poly(p.torso)} strokeWidth="9.5" />
      {p.arms.map((arm, i) => <path key={`a${i}`} d={poly(arm)} strokeWidth="4" />)}
      <circle cx={p.head[0]} cy={p.head[1]} r="5.4" fill={color} stroke="none" />
    </g>
  );
}

/** Rede: malha, faixa de cima, postes e antenas listradas. */
function Net({ x, y, w, h, base, dark = false, antennas = true, opacity = 1 }: { x: number; y: number; w: number; h: number; base: number; dark?: boolean; antennas?: boolean; opacity?: number }) {
  const band = dark ? "#12062a" : "#fff";
  const post = dark ? "#12062a" : "#d9d4ea";
  return (
    <g opacity={opacity}>
      <rect x={x} y={y} width={w} height={h} fill={dark ? "url(#pb-mesh-dark)" : "url(#pb-mesh)"} opacity={dark ? 1 : 0.75} />
      <rect x={x} y={y - 1.6} width={w} height="3.4" fill={band} />
      <rect x={x} y={y + h - 0.6} width={w} height="1.2" fill={band} opacity=".8" />
      <rect x={x - 5} y={y - 4} width="3.4" height={base - y + 4} rx="1" fill={post} />
      <rect x={x + w + 1.6} y={y - 4} width="3.4" height={base - y + 4} rx="1" fill={post} />
      {antennas && !dark && [x + 4, x + w - 4].map((ax) => (
        <g key={ax}>
          {Array.from({ length: 6 }, (_, i) => <rect key={i} x={ax - 1} y={y - 14 + i * ((h + 14) / 6)} width="2" height={r1((h + 14) / 6)} fill={i % 2 ? "#fff" : "#e5383b"} />)}
        </g>
      ))}
    </g>
  );
}

function Heart({ x, y, s, fill, opacity = 1, stroke, strokeWidth }: { x: number; y: number; s: number; fill: string; opacity?: number; stroke?: string; strokeWidth?: number }) {
  return <path transform={`translate(${x} ${y}) scale(${s})`} d={HEART} fill={fill} opacity={opacity} stroke={stroke} strokeWidth={strokeWidth} strokeLinejoin="round" />;
}
const HEART = "M0 5C-9-1.5-6.5-8.6-2.6-8.6c1.2 0 2.1.6 2.6 1.6.5-1 1.4-1.6 2.6-1.6C6.5-8.6 9-1.5 0 5Z";

/** Estrela de 4 pontas (brilho). */
function Twinkle({ x, y, s = 1, fill = "#fff", opacity = 1 }: { x: number; y: number; s?: number; fill?: string; opacity?: number }) {
  return <path transform={`translate(${x} ${y}) scale(${s})`} d="M0-7C.6-2.4 2.4-.6 7 0 2.4.6.6 2.4 0 7-.6 2.4-2.4.6-7 0-2.4-.6-.6-2.4 0-7Z" fill={fill} opacity={opacity} />;
}

function Stars({ n, y0 = 0, y1, seed, color = "#fff", max = 1.3, x0 = 0, x1 = 600 }: { n: number; y0?: number; y1: number; seed: number; color?: string; max?: number; x0?: number; x1?: number }) {
  return (
    <>
      {Array.from({ length: n }, (_, i) => {
        const big = rand(seed + i + 200) > 0.9;
        return <circle key={i} cx={r1(x0 + rand(seed + i) * (x1 - x0))} cy={r1(y0 + rand(seed + i + 100) * (y1 - y0))} r={big ? max : r1(0.35 + rand(seed + i + 300) * max * 0.6)} fill={color} opacity={r1(0.3 + rand(seed + i + 400) * 0.7)} />;
      })}
    </>
  );
}

/** Nuvem fofa: bolhas com o fundo sombreado e a base achatada. */
function Cumulus({ x, y, s = 1, opacity = 1 }: { x: number; y: number; s?: number; opacity?: number }) {
  const puffs: [number, number, number][] = [[-42, -4, 10], [-30, -10, 14], [-14, -18, 18], [6, -26, 22], [24, -16, 16], [38, -9, 12], [48, -3, 8], [-22, -2, 12], [12, -6, 16]];
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} opacity={opacity}>
      <g clipPath="url(#pb-cloud-clip)">
        {puffs.map(([cx, cy, r], i) => <circle key={i} cx={cx} cy={cy} r={r} fill="url(#pb-cloud)" />)}
      </g>
    </g>
  );
}

/** Folha de palmeira feita de folíolos ao longo de um talo curvo. */
function Frond({ x, y, angle, len, droop = 0.35, color, shade = "#0b4d2b", width = 2.2 }: { x: number; y: number; angle: number; len: number; droop?: number; color: string; shade?: string; width?: number }) {
  const P0: Pt = [0, 0];
  const P1: Pt = [len * 0.55, -len * 0.14];
  const P2: Pt = [len, len * droop];
  const at = (t: number): Pt => [
    (1 - t) ** 2 * P0[0] + 2 * (1 - t) * t * P1[0] + t * t * P2[0],
    (1 - t) ** 2 * P0[1] + 2 * (1 - t) * t * P1[1] + t * t * P2[1],
  ];
  const leaflets: ReactNode[] = [];
  const steps = 11;
  // A gravidade puxa as folhinhas pra baixo no desenho final, não no eixo do talo.
  const rad = (-angle * Math.PI) / 180;
  const gx = -Math.sin(rad);
  const gy = Math.cos(rad);
  for (let i = 1; i <= steps; i++) {
    const t = 0.12 + (i / steps) * 0.86;
    const [px, py] = at(t);
    const [qx, qy] = at(Math.min(1, t + 0.01));
    const tl = Math.hypot(qx - px, qy - py) || 1;
    const tx = (qx - px) / tl;
    const ty = (qy - py) / tl;
    const l = len * 0.46 * Math.sin(Math.PI * Math.min(0.92, t + 0.08)) ** 0.7;
    for (const side of [-1, 1]) {
      const nx = -ty * side;
      const ny = tx * side;
      const dx = nx * 0.55 + tx * 0.5 + gx * 0.75;
      const dy = ny * 0.55 + ty * 0.5 + gy * 0.75;
      const dl = Math.hypot(dx, dy) || 1;
      const ux = dx / dl;
      const uy = dy / dl;
      const ex = px + ux * l;
      const ey = py + uy * l;
      // Folíolo em forma de lâmina: largo no meio, fino nas pontas, levemente curvo.
      const mx = px + ux * l * 0.45 + gx * l * 0.08;
      const my = py + uy * l * 0.45 + gy * l * 0.08;
      const wv = Math.max(1.2, l * 0.11) * (width / 2.2);
      leaflets.push(
        <path
          key={`${i}${side}`}
          d={`M${r1(px)} ${r1(py)}Q${r1(mx - uy * wv)} ${r1(my + ux * wv)} ${r1(ex)} ${r1(ey)}Q${r1(mx + uy * wv)} ${r1(my - ux * wv)} ${r1(px)} ${r1(py)}Z`}
          fill={side > 0 && i % 2 ? shade : color}
        />,
      );
    }
  }
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle})`}>
      {leaflets}
      <path d={`M0 0Q${r1(P1[0])} ${r1(P1[1])} ${r1(P2[0])} ${r1(P2[1])}`} fill="none" stroke={shade} strokeWidth={width * 1.2} strokeLinecap="round" />
    </g>
  );
}

/** Raio irregular com galhos. */
function Lightning({ from, to, seed, branches = 2 }: { from: Pt; to: Pt; seed: number; branches?: number }) {
  const n = 9;
  const main: Pt[] = Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    const jitter = i === 0 || i === n ? 0 : (rand(seed + i) - 0.5) * 34;
    return [r1(from[0] + (to[0] - from[0]) * t + jitter), r1(from[1] + (to[1] - from[1]) * t)];
  });
  const forks: Pt[][] = Array.from({ length: branches }, (_, b) => {
    const start = main[2 + b * 3];
    const dir = b % 2 ? 1 : -1;
    const pts: Pt[] = [start];
    for (let i = 1; i < 6; i++) {
      const [px, py] = pts[i - 1];
      const back = i % 2 === 0 ? -0.6 : 1;
      pts.push([r1(px + dir * back * (3 + rand(seed + 50 + b * 9 + i) * 6)), r1(py + 4 + rand(seed + 80 + b * 7 + i) * 6)]);
    }
    return pts;
  });
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <g stroke="#a5b4fc" strokeWidth="7" opacity=".55" filter="url(#pb-soft)">
        <path d={poly(main)} />
        {forks.map((f, i) => <path key={i} d={poly(f)} strokeWidth="4" />)}
      </g>
      <g stroke="#f8fafc">
        <path d={poly(main)} strokeWidth="2.2" />
        {forks.map((f, i) => <path key={i} d={poly(f)} strokeWidth="1.2" />)}
      </g>
    </g>
  );
}

/** Fileira de labaredas: corpo largo embaixo, ponta fina e curva puxada pelo vento. */
function flameRow(y0: number, amp: number, count: number, seed: number, lean = 0.5) {
  const w = 640 / count;
  let d = `M-20 210L-20 ${y0}`;
  for (let i = 0; i < count; i++) {
    const xv = -20 + i * w;
    const h = amp * (0.4 + rand(seed + i) * 0.9);
    const tip = xv + w * (0.5 - lean * 0.6) + (rand(seed + i + 40) - 0.5) * w * 0.4;
    d += `C${r1(xv + w * 0.05)} ${r1(y0 - h * 0.45)} ${r1(tip + w * 0.55)} ${r1(y0 - h * 0.55)} ${r1(tip)} ${r1(y0 - h)}`;
    d += `C${r1(tip + w * 0.45)} ${r1(y0 - h * 0.7)} ${r1(xv + w * 1.05)} ${r1(y0 - h * 0.4)} ${r1(xv + w)} ${y0}`;
  }
  return `${d}L620 210Z`;
}

/** Dígito de 7 segmentos (placar). */
const SEGS: Record<string, string> = { "0": "abcdef", "1": "bc", "2": "abged", "3": "abgcd", "4": "fgbc", "5": "afgcd", "6": "afgedc", "7": "abc", "8": "abcdefg", "9": "abcdfg" };
function Digit({ x, y, d, color, s = 1 }: { x: number; y: number; d: string; color: string; s?: number }) {
  const on = SEGS[d] ?? "";
  const seg: Record<string, [number, number, number, number]> = {
    a: [1.2, 0, 5.6, 1.4], b: [6.8, 1.2, 1.4, 5.6], c: [6.8, 8.2, 1.4, 5.6], d: [1.2, 13.6, 5.6, 1.4], e: [0, 8.2, 1.4, 5.6], f: [0, 1.2, 1.4, 5.6], g: [1.2, 6.8, 5.6, 1.4],
  };
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {Object.entries(seg).map(([k, [sx, sy, sw, sh]]) => <rect key={k} x={sx} y={sy} width={sw} height={sh} rx=".5" fill={color} opacity={on.includes(k) ? 1 : 0.1} />)}
    </g>
  );
}

/* ─────────────────────────────── as capas ─────────────────────────────── */

type Draw = (logos: BannerLogos) => ReactNode;

const ART: Record<BannerId, Draw> = {
  /* Quadra coberta vista do fundo: piso encerado, linhas, rede com antenas. */
  quadra: () => {
    const side = (y: number, s: -1 | 1) => r1(s < 0 ? 190 - 210 * ((y - 104) / 111) : 410 + 210 * ((y - 104) / 111));
    return (
      <>
        <defs>
          <linearGradient id="bq-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0c0722" /><stop offset="1" stopColor="#2c1868" /></linearGradient>
          <linearGradient id="bq-floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#9c5d2c" /><stop offset="1" stopColor="#e2a263" /></linearGradient>
          <linearGradient id="bq-court" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#b9552a" /><stop offset="1" stopColor="#ef8b45" /></linearGradient>
          <linearGradient id="bq-beam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff4d6" stopOpacity=".32" /><stop offset="1" stopColor="#fff4d6" stopOpacity="0" /></linearGradient>
          <radialGradient id="bq-shine"><stop offset="0" stopColor="#fff1d0" stopOpacity=".6" /><stop offset="1" stopColor="#fff1d0" stopOpacity="0" /></radialGradient>
        </defs>
        <rect width="600" height="200" fill="url(#bq-bg)" />
        <rect y="78" width="600" height="24" fill="#170c3d" />
        {Array.from({ length: 9 }, (_, i) => <rect key={i} x={-14 + i * 72} y="82" width="64" height="15" rx="2" fill={i % 2 ? "#5a2cc0" : "#36198a"} />)}
        <rect y="82" width="600" height="2" fill="#fff" opacity=".08" />
        {[110, 300, 490].map((x) => (
          <g key={x}>
            <polygon points={`${x - 9},0 ${x + 9},0 ${x + 86},178 ${x - 86},178`} fill="url(#bq-beam)" />
            <rect x={x - 17} y="-2" width="34" height="7" rx="3" fill="#fffbea" />
          </g>
        ))}
        <rect y="102" width="600" height="98" fill="url(#bq-floor)" />
        <g stroke="#5b2e0f" strokeWidth=".7" opacity=".35">
          {Array.from({ length: 41 }, (_, i) => {
            const k = i - 20;
            return <line key={i} x1={300 + k * 15} y1="102" x2={r1(300 + k * 15 * 2.7)} y2="200" />;
          })}
        </g>
        <polygon points="190,104 410,104 620,215 -20,215" fill="url(#bq-court)" />
        <g stroke="#fff" strokeLinecap="round" fill="none" opacity=".92">
          <path d="M190 104L-20 215M410 104L620 215M190 104H410" strokeWidth="2.2" />
          <line x1={side(117, -1)} y1="117" x2={side(117, 1)} y2="117" strokeWidth="1.6" />
          <line x1={side(150, -1)} y1="150" x2={side(150, 1)} y2="150" strokeWidth="2.4" />
        </g>
        {[[105, 152], [300, 140], [495, 152]].map(([x, y]) => <ellipse key={x} cx={x} cy={y} rx="78" ry="9" fill="url(#bq-shine)" />)}
        <polygon points={`140,128 460,128 500,140 100,140`} fill="#3a1608" opacity=".25" />
        <Net x={140} y={77} w={320} h={23} base={129} />
        <Trail d="M232 96Q300 20 412 44" />
        <Volleyball x={428} y={50} r={13} rot={20} />
        <Vignette opacity={0.5} />
        <Grain />
      </>
    );
  },

  /* Praia do Futuro: mar, jangada, barraca, coqueiro e rede de praia. */
  praia: () => (
    <>
      <defs>
        <linearGradient id="bp-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2d8fe0" /><stop offset=".6" stopColor="#8fd1f4" /><stop offset="1" stopColor="#ffe6b3" /></linearGradient>
        <linearGradient id="bp-sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0f6fb8" /><stop offset="1" stopColor="#38bfe0" /></linearGradient>
        <linearGradient id="bp-sand" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f6dfab" /><stop offset="1" stopColor="#dcae6a" /></linearGradient>
        <radialGradient id="bp-sun"><stop offset="0" stopColor="#fffbe6" /><stop offset=".25" stopColor="#fff2b8" stopOpacity=".9" /><stop offset="1" stopColor="#ffe08a" stopOpacity="0" /></radialGradient>
        <linearGradient id="bp-trunk" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#6b4320" /><stop offset="1" stopColor="#a8743f" /></linearGradient>
      </defs>
      <rect width="600" height="200" fill="url(#bp-sky)" />
      <circle cx="505" cy="34" r="70" fill="url(#bp-sun)" />
      <circle cx="505" cy="34" r="13" fill="#fffdf2" />
      <g fill="#fff" filter="url(#pb-soft)" opacity=".55">
        <ellipse cx="300" cy="30" rx="90" ry="4" />
        <ellipse cx="350" cy="40" rx="60" ry="3" />
        <ellipse cx="160" cy="22" rx="70" ry="3.5" />
      </g>
      <rect y="92" width="600" height="34" fill="url(#bp-sea)" />
      <rect y="92" width="600" height="1.4" fill="#fff" opacity=".5" />
      {Array.from({ length: 22 }, (_, i) => <rect key={i} x={r1(450 + rand(i + 3) * 110)} y={r1(95 + rand(i + 30) * 26)} width={r1(4 + rand(i + 60) * 10)} height="1.1" rx=".5" fill="#fffbe0" opacity={r1(0.4 + rand(i + 90) * 0.5)} />)}
      {/* jangadas */}
      <g transform="translate(395 96)">
        <path d="M-12 4H12L9 7H-9Z" fill="#5b3a1e" />
        <path d="M0 4V-30L16 2Z" fill="#fffaf0" />
        <path d="M0-30 16 2 12 2 0-22Z" fill="#e05252" opacity=".85" />
        <line x1="0" y1="4" x2="0" y2="-31" stroke="#5b3a1e" strokeWidth="1.1" />
      </g>
      <g transform="translate(262 94) scale(.55)" opacity=".8">
        <path d="M-12 4H12L9 7H-9Z" fill="#5b3a1e" />
        <path d="M0 4V-30L16 2Z" fill="#fffaf0" />
        <line x1="0" y1="4" x2="0" y2="-31" stroke="#5b3a1e" strokeWidth="1.4" />
      </g>
      <path d="M0 124Q40 119 80 124T160 124T240 124T320 124T400 124T480 124T560 124T640 124V132H0Z" fill="#e9f8ff" opacity=".85" />
      <path d="M0 128Q150 121 300 129T600 126V200H0Z" fill="url(#bp-sand)" />
      <path d="M0 128Q150 121 300 129T600 126V134Q300 137 0 133Z" fill="#c9965a" opacity=".35" />
      {Array.from({ length: 60 }, (_, i) => <circle key={i} cx={r1(rand(i + 7) * 600)} cy={r1(134 + rand(i + 70) * 60)} r=".7" fill="#a8753d" opacity=".45" />)}
      {/* rede de praia com cordas */}
      <g stroke="#6b4a2b" strokeWidth=".8" opacity=".8">
        <line x1="296" y1="100" x2="276" y2="150" />
        <line x1="484" y1="100" x2="504" y2="150" />
      </g>
      <Net x={300} y={102} w={180} h={20} base={152} antennas={false} />
      <FloorShadow x={392} y={164} rx={14} opacity={0.3} />
      <Volleyball x={392} y={153} r={11} rot={-25} />
      {[[350, 170], [362, 178], [340, 186]].map(([x, y], i) => <ellipse key={i} cx={x} cy={y} rx="2.6" ry="1.4" fill="#b98546" opacity=".5" transform={`rotate(-20 ${x} ${y})`} />)}
      {/* barraca */}
      <g transform="translate(556 104) rotate(-8)">
        <line x1="0" y1="-22" x2="0" y2="52" stroke="#7a5230" strokeWidth="2.2" />
        <path d="M-36 0C-35-14-20-22 0-23C20-22 35-14 36 0Z" fill="#f97316" />
        {[-3, -1, 1].map((k) => {
          const a = r1(36 * Math.sin((k * 30 * Math.PI) / 180));
          const b = r1(36 * Math.sin(((k + 1) * 30 * Math.PI) / 180));
          return <path key={k} d={`M0-23Q${r1(a * 0.8)}-19 ${a} 0L${b} 0Q${r1(b * 0.8)}-19 0-23Z`} fill="#fff7ed" />;
        })}
        <path d="M-36 0Q-18-4 0 0T36 0" fill="none" stroke="#c2410c" strokeWidth="1" opacity=".6" />
      </g>
      {/* coqueiro */}
      <path d="M64 200C70 150 66 100 88 52" stroke="url(#bp-trunk)" strokeWidth="7" fill="none" strokeLinecap="round" />
      {[0, 1, 2, 3, 4, 5, 6].map((i) => <path key={i} d={`M${r1(64 + i * 3.4)} ${200 - i * 21}l5 -3`} stroke="#4a2c12" strokeWidth="1.2" opacity=".5" />)}
      <Frond x={88} y={52} angle={-170} len={70} color="#166534" />
      <Frond x={88} y={52} angle={-120} len={58} color="#15803d" />
      <Frond x={88} y={52} angle={-40} len={72} color="#166534" />
      <Frond x={88} y={52} angle={10} len={66} color="#15803d" />
      <Frond x={88} y={52} angle={-80} len={46} color="#22a04b" />
      <circle cx="86" cy="58" r="4" fill="#5b3a1e" /><circle cx="92" cy="57" r="3.6" fill="#6b4320" />
      <Grain opacity={0.35} />
    </>
  ),

  /* Pôr do sol: atleta cortando contra o sol, bloqueio do outro lado. */
  "por-do-sol": () => (
    <>
      <defs>
        <linearGradient id="bs-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1b0b3f" /><stop offset=".35" stopColor="#5a1a6e" /><stop offset=".62" stopColor="#c43a6b" /><stop offset=".82" stopColor="#f6873a" /><stop offset="1" stopColor="#ffd27a" />
        </linearGradient>
        <radialGradient id="bs-sun"><stop offset="0" stopColor="#fff3c4" /><stop offset=".55" stopColor="#ffd36b" /><stop offset="1" stopColor="#ff9b45" /></radialGradient>
        <radialGradient id="bs-halo"><stop offset="0" stopColor="#ffcf7a" stopOpacity=".55" /><stop offset="1" stopColor="#ff7a45" stopOpacity="0" /></radialGradient>
        <linearGradient id="bs-sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7a2a5e" /><stop offset="1" stopColor="#1d0b33" /></linearGradient>
      </defs>
      <rect width="600" height="200" fill="url(#bs-sky)" />
      <Stars n={22} y1={50} seed={7} />
      <circle cx="400" cy="112" r="110" fill="url(#bs-halo)" />
      <circle cx="400" cy="112" r="52" fill="url(#bs-sun)" />
      <g fill="#7c2257" opacity=".55">
        <rect x="300" y="96" width="210" height="3" rx="1.5" />
        <rect x="330" y="104" width="150" height="2" rx="1" />
        <rect x="250" y="76" width="140" height="2.5" rx="1.2" opacity=".6" />
      </g>
      <rect y="132" width="600" height="68" fill="url(#bs-sea)" />
      {[0, 1, 2, 3, 4, 5].map((i) => <rect key={i} x={r1(400 - (46 - i * 6))} y={136 + i * 6} width={r1((46 - i * 6) * 2)} height="1.8" rx=".9" fill="#ffd27a" opacity={r1(0.75 - i * 0.1)} />)}
      <path d="M0 150Q120 140 240 152T600 146V200H0Z" fill="#14072a" />
      <Athlete x={446} y={128} s={0.95} color="#2a0f45" pose="block" flip />
      <Net x={286} y={100} w={196} h={20} base={152} dark antennas={false} />
      <Athlete x={372} y={104} s={1.3} color="#14072a" pose="spike" />
      <circle cx="392" cy="38" r="6.8" fill="#14072a" />
      {[[230, 40], [248, 46], [262, 37]].map(([x, y], i) => <path key={i} d={`M${x - 5} ${y - 2}Q${x - 2} ${y - 4} ${x} ${y}Q${x + 2} ${y - 4} ${x + 5} ${y - 2}`} fill="none" stroke="#2a0c3f" strokeWidth="1.2" />)}
      <Grain opacity={0.4} />
    </>
  ),

  /* Vôlei por Amor: coração-bola (como a nossa logo), em roxo, com brilho. */
  vpa: () => (
    <>
      <defs>
        <linearGradient id="bv-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#5b21b6" /><stop offset=".55" stopColor="#30136f" /><stop offset="1" stopColor="#140932" /></linearGradient>
        <radialGradient id="bv-glow"><stop offset="0" stopColor="#e879f9" stopOpacity=".55" /><stop offset="1" stopColor="#7c3aed" stopOpacity="0" /></radialGradient>
        <clipPath id="bv-heart"><path d={HEART} /></clipPath>
        <radialGradient id="bv-shade" cx=".35" cy=".25" r=".9"><stop offset="0" stopColor="#fff" stopOpacity=".55" /><stop offset=".45" stopColor="#fff" stopOpacity="0" /><stop offset="1" stopColor="#2e1065" stopOpacity=".55" /></radialGradient>
      </defs>
      <rect width="600" height="200" fill="url(#bv-bg)" />
      <g stroke="#fff" opacity=".05" strokeWidth="14">
        {[0, 1, 2, 3].map((i) => <line key={i} x1={160 + i * 60} y1="-10" x2={60 + i * 60} y2="210" />)}
      </g>
      <circle cx="440" cy="92" r="130" fill="url(#bv-glow)" />
      <g fill="#f0abfc" filter="url(#pb-blur)" opacity=".45">
        <circle cx="560" cy="30" r="16" />
        <circle cx="290" cy="40" r="10" />
        <circle cx="330" cy="150" r="12" />
      </g>
      <g transform="translate(440 110) scale(9.4)" filter="url(#pb-drop)">
        <path d={HEART} fill="#f5f0ff" />
        <g clipPath="url(#bv-heart)">
          <g transform="translate(0 -2.6) rotate(-25) scale(.95)">
            {BALL_PANELS.map((panel, k) => (
              <g key={k}>
                <path d={panel.d} fill={["#7c3aed", "#f5f0ff", "#c026d3"][k]} />
                {panel.seams.map((d) => <path key={d} d={d} fill="none" stroke="#2e1065" strokeOpacity=".35" strokeWidth=".22" />)}
              </g>
            ))}
            {BALL_PANELS.map((panel, k) => <path key={k} d={panel.d} fill="none" stroke="#2e1065" strokeOpacity=".45" strokeWidth=".3" />)}
          </g>
          <path d={HEART} fill="url(#bv-shade)" />
        </g>
        <path d={HEART} fill="none" stroke="#fff" strokeWidth=".28" />
      </g>
      <Twinkle x={524} y={44} s={1.4} />
      <Twinkle x={356} y={60} s={0.8} opacity={0.8} />
      <Twinkle x={540} y={150} s={0.7} opacity={0.6} />
      {[[250, 70, 0.9], [280, 120, 0.6], [585, 100, 0.7]].map(([x, y, s], i) => <Heart key={i} x={x} y={y} s={s} fill="#f5d0fe" opacity={0.5} />)}
      <Vignette opacity={0.35} />
      <Grain />
    </>
  ),

  /* Logo VPA em destaque com luz atrás e sombra de verdade. */
  "logo-roxo": (logos) => (
    <>
      <defs>
        <linearGradient id="blr-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#4c1d95" /><stop offset=".6" stopColor="#2e1170" /><stop offset="1" stopColor="#130833" /></linearGradient>
        <radialGradient id="blr-light"><stop offset="0" stopColor="#c4b5fd" stopOpacity=".6" /><stop offset=".5" stopColor="#8b5cf6" stopOpacity=".2" /><stop offset="1" stopColor="#8b5cf6" stopOpacity="0" /></radialGradient>
      </defs>
      <rect width="600" height="200" fill="url(#blr-bg)" />
      <g opacity=".07" fill="#fff">
        {Array.from({ length: 14 }, (_, i) => <polygon key={i} points={`420,96 ${r1(420 + 420 * Math.cos((i * 2 * Math.PI) / 14))},${r1(96 + 420 * Math.sin((i * 2 * Math.PI) / 14))} ${r1(420 + 420 * Math.cos(((i + 0.45) * 2 * Math.PI) / 14))},${r1(96 + 420 * Math.sin(((i + 0.45) * 2 * Math.PI) / 14))}`} />)}
      </g>
      <circle cx="420" cy="96" r="150" fill="url(#blr-light)" />
      <g fill="none" stroke="#c4b5fd" opacity=".35">
        <circle cx="420" cy="96" r="104" strokeWidth="1" />
        <circle cx="420" cy="96" r="114" strokeWidth=".6" strokeDasharray="2 5" />
      </g>
      <image href={logos.white} x="325" y="18" width="190" height="157" filter="url(#pb-drop)" />
      <Twinkle x={540} y={40} s={1.3} />
      <Twinkle x={318} y={150} s={0.8} opacity={0.7} />
      <Twinkle x={300} y={34} s={0.6} opacity={0.6} />
      <Volleyball x={250} y={62} r={11} rot={30} tint="#a78bfa" />
      <Trail d="M150 120Q190 60 238 64" color="#ddd6fe" opacity={0.4} />
      <Vignette opacity={0.4} />
      <Grain />
    </>
  ),

  /* Estampa: monograma VPA em diagonal, como tecido estampado. */
  "logo-padrao": (logos) => (
    <>
      <defs>
        <linearGradient id="blp-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#6d28d9" /><stop offset="1" stopColor="#24104f" /></linearGradient>
        <linearGradient id="blp-sheen" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset=".5" stopColor="#fff" stopOpacity=".14" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient>
        {/* Um ladrilho com duas logos repetido pelo padrão: no cartão em imagem a logo
            vai embutida, e repetir a imagem dezenas de vezes estoura o gerador. */}
        <pattern id="blp-tile" width="140" height="128" patternUnits="userSpaceOnUse" patternTransform="rotate(-14) translate(-20 -10)">
          <image href={logos.white} x="8" y="8" width="54" height="45" opacity=".22" />
          <image href={logos.white} x="84" y="72" width="40" height="33" opacity=".12" />
        </pattern>
      </defs>
      <rect width="600" height="200" fill="url(#blp-bg)" />
      <rect width="600" height="200" fill="url(#blp-tile)" />
      <rect x="-100" y="40" width="800" height="60" fill="url(#blp-sheen)" transform="rotate(-14 300 100)" />
      <Vignette opacity={0.55} />
      <Grain />
    </>
  ),

  /* Logo original em camisa sublimada: listras diagonais e meio-tom. */
  "logo-colorida": (logos) => (
    <>
      <defs>
        <linearGradient id="blc-bg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#dbe4ff" /><stop offset="1" stopColor="#ffffff" /></linearGradient>
        <pattern id="blc-dot1" width="7" height="7" patternUnits="userSpaceOnUse"><circle cx="3.5" cy="3.5" r="1.7" fill="#1e3a8a" /></pattern>
        <pattern id="blc-dot2" width="7" height="7" patternUnits="userSpaceOnUse"><circle cx="3.5" cy="3.5" r="1" fill="#1e3a8a" /></pattern>
        <pattern id="blc-dot3" width="7" height="7" patternUnits="userSpaceOnUse"><circle cx="3.5" cy="3.5" r=".5" fill="#1e3a8a" /></pattern>
      </defs>
      <rect width="600" height="200" fill="url(#blc-bg)" />
      <g transform="skewX(-28)">
        <rect x="80" y="0" width="70" height="200" fill="#1e3a8a" />
        <rect x="160" y="0" width="18" height="200" fill="#facc15" />
        <rect x="186" y="0" width="40" height="200" fill="#2563eb" />
        <rect x="234" y="0" width="8" height="200" fill="#1e3a8a" />
        <rect x="250" y="0" width="40" height="200" fill="url(#blc-dot1)" opacity=".5" />
        <rect x="290" y="0" width="40" height="200" fill="url(#blc-dot2)" opacity=".4" />
        <rect x="330" y="0" width="40" height="200" fill="url(#blc-dot3)" opacity=".35" />
      </g>
      <g opacity=".08" stroke="#1e3a8a" strokeWidth="1">{Array.from({ length: 40 }, (_, i) => <line key={i} x1={i * 16} y1="0" x2={i * 16 - 110} y2="200" />)}</g>
      <image href={logos.color} x="380" y="4" width="192" height="192" filter="url(#pb-drop)" />
      <Grain opacity={0.3} />
    </>
  ),

  /* Logo pintada no piso, quadra vista de cima. */
  "logo-quadra": (logos) => (
    <>
      <defs>
        <linearGradient id="blq-out" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#d9692f" /><stop offset="1" stopColor="#b44f20" /></linearGradient>
        <linearGradient id="blq-in" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#3466d8" /><stop offset="1" stopColor="#1e40af" /></linearGradient>
        <radialGradient id="blq-spot"><stop offset="0" stopColor="#fff" stopOpacity=".28" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></radialGradient>
      </defs>
      <rect width="600" height="200" fill="url(#blq-out)" />
      <rect x="40" y="18" width="520" height="164" fill="url(#blq-in)" />
      <g stroke="#fff" fill="none" strokeWidth="3">
        <rect x="40" y="18" width="520" height="164" />
        <line x1="213" y1="18" x2="213" y2="182" strokeWidth="2.4" />
        <line x1="387" y1="18" x2="387" y2="182" strokeWidth="2.4" />
      </g>
      <image href={logos.white} x="398" y="40" width="148" height="122" opacity=".5" />
      <rect x="296" y="4" width="8" height="192" fill="#0b1640" opacity=".35" filter="url(#pb-soft)" />
      <rect x="297" y="6" width="5" height="188" fill="#f4f4f5" />
      <rect x="297.8" y="6" width="3.4" height="188" fill="url(#pb-mesh-dark)" opacity=".6" />
      <circle cx="299.5" cy="8" r="5" fill="#e5e7eb" stroke="#64748b" strokeWidth="1" />
      <circle cx="299.5" cy="192" r="5" fill="#e5e7eb" stroke="#64748b" strokeWidth="1" />
      {[[150, 60], [450, 60], [300, 150]].map(([x, y]) => <ellipse key={`${x}${y}`} cx={x} cy={y} rx="80" ry="34" fill="url(#blq-spot)" />)}
      <ellipse cx="262" cy="74" rx="11" ry="9" fill="#0b1640" opacity=".35" filter="url(#pb-soft)" />
      <Volleyball x={256} y={68} r={10} rot={70} />
      <Grain opacity={0.35} />
    </>
  ),

  /* Céu de domingo: nuvens com volume, reflexo do sol e a bola subindo. */
  "ceu-azul": () => (
    <>
      <defs>
        <linearGradient id="bca-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1559cc" /><stop offset=".6" stopColor="#58aaf0" /><stop offset="1" stopColor="#c3e7fb" /></linearGradient>
        <radialGradient id="bca-sun"><stop offset="0" stopColor="#fff" /><stop offset=".2" stopColor="#fffbe0" stopOpacity=".9" /><stop offset="1" stopColor="#fffbe0" stopOpacity="0" /></radialGradient>
      </defs>
      <rect width="600" height="200" fill="url(#bca-sky)" />
      <circle cx="96" cy="26" r="80" fill="url(#bca-sun)" />
      <g fill="#fff" filter="url(#pb-soft)" opacity=".5">
        <ellipse cx="250" cy="34" rx="80" ry="3" />
        <ellipse cx="290" cy="42" rx="50" ry="2" />
      </g>
      <Cumulus x={320} y={74} s={0.55} opacity={0.8} />
      <Cumulus x={548} y={64} s={0.85} />
      <Cumulus x={160} y={150} s={1.35} />
      <Cumulus x={470} y={186} s={1.6} />
      <Trail d="M300 160Q330 90 404 60" />
      <Volleyball x={418} y={56} r={15} rot={-30} />
      <g stroke="#fff" strokeWidth="1.4" strokeLinecap="round" opacity=".7">
        <path d="M436 40l7-5M440 52l9-1M432 30l4-7" />
      </g>
      {[[230, 34], [244, 40]].map(([x, y], i) => <path key={i} d={`M${x - 4} ${y - 1}Q${x - 2} ${y - 3} ${x} ${y}Q${x + 2} ${y - 3} ${x + 4} ${y - 1}`} fill="none" stroke="#1e3a8a" strokeWidth="1" opacity=".6" />)}
      <Grain opacity={0.3} />
    </>
  ),

  /* Fundo do mar: raios de luz, cardume, alga e a bola boiando lá em cima. */
  oceano: () => (
    <>
      <defs>
        <linearGradient id="boc-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3fd0e6" /><stop offset=".45" stopColor="#0d6f99" /><stop offset="1" stopColor="#04223f" /></linearGradient>
        <linearGradient id="boc-ray" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#e0fbff" stopOpacity=".4" /><stop offset="1" stopColor="#e0fbff" stopOpacity="0" /></linearGradient>
      </defs>
      <rect width="600" height="200" fill="url(#boc-g)" />
      <g filter="url(#pb-soft)">
        {[[300, 26], [380, 18], [470, 30], [540, 16], [200, 22]].map(([x, w], i) => <polygon key={i} points={`${x - w / 2},0 ${x + w / 2},0 ${x + w * 1.6 + 40},200 ${x + 40 - w * 0.6},200`} fill="url(#boc-ray)" />)}
      </g>
      <path d="M0 9Q25 3 50 9T100 9T150 9T200 9T250 9T300 9T350 9T400 9T450 9T500 9T550 9T600 9V0H0Z" fill="#b8f3ff" opacity=".55" />
      <g stroke="#dffaff" fill="none" strokeWidth="1" opacity=".35">
        <path d="M30 22q10-5 20 0t20 0M120 30q12-6 24 0M230 20q10-5 20 0t20 0M520 26q10-5 20 0" />
      </g>
      <Volleyball x={430} y={4} r={16} rot={15} />
      <ellipse cx="430" cy="16" rx="18" ry="4" fill="#0b4f73" opacity=".25" />
      {/* cardume */}
      {Array.from({ length: 15 }, (_, i) => {
        const t = i / 14;
        const x = r1(350 + t * 170 + (rand(i + 5) - 0.5) * 20);
        const y = r1(98 - Math.sin(t * Math.PI) * 30 + (rand(i + 9) - 0.5) * 18);
        const s = r1(0.7 + rand(i + 13) * 0.5);
        return <path key={i} transform={`translate(${x} ${y}) scale(${s})`} d="M-6 0C-3-3.4 3-3.4 6 0 3 3.4-3 3.4-6 0ZM6 0 10-3.4V3.4Z" fill="#0a3b5c" opacity=".8" />;
      })}
      {/* algas */}
      {[[540, 1], [560, 1.2], [585, 0.9], [515, 0.8]].map(([x, s], i) => (
        <path key={i} d={`M${x} 205C${x - 12 * s} ${170 - i * 4} ${x + 12 * s} ${140 - i * 6} ${x - 4} ${r1(100 - i * 6 * s)}C${x + 14 * s} ${140 - i * 6} ${x - 2} ${170} ${x + 8} 205Z`} fill={i % 2 ? "#0f5e4a" : "#137a5c"} opacity=".9" />
      ))}
      <path d="M290 205Q330 172 384 178T468 170Q512 164 548 205Z" fill="#06263e" />
      {/* coral galhado */}
      <g stroke="#f07ba0" strokeLinecap="round" fill="none">
        <path d="M418 182C418 172 416 164 420 156C423 150 422 144 418 138" strokeWidth="4" />
        <path d="M419 166C412 162 408 156 409 148M420 156C428 152 432 146 431 138M409 148C405 145 404 141 405 137M431 138C434 134 434 130 432 127" strokeWidth="2.8" />
      </g>
      {[[418, 137], [405, 136], [432, 126]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="2" fill="#ffb3c8" />)}
      {/* coral leque e coral cérebro */}
      <path d="M452 178C440 160 446 140 462 136C478 140 484 160 472 178Z" fill="#ff9e6b" opacity=".9" />
      <g stroke="#c8552c" strokeWidth=".7" fill="none" opacity=".7"><path d="M462 178V140M462 170L450 152M462 170L474 152M462 160L454 144M462 160L470 144" /></g>
      <ellipse cx="392" cy="182" rx="14" ry="9" fill="#9b7bd8" />
      <path d="M382 180q5-5 10 0t10 0M384 185q4-4 8 0t8 0" stroke="#6b4fb0" strokeWidth="1" fill="none" />
      {[[424, 140, 3], [430, 120, 2.2], [421, 104, 1.6], [476, 150, 2], [480, 132, 1.4]].map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} fill="#fff" fillOpacity=".1" stroke="#c8f6ff" strokeWidth=".8" />)}
      <Vignette opacity={0.4} />
      <Grain opacity={0.35} />
    </>
  ),

  /* Sakura: galho de cerejeira no canto, pétalas de verdade caindo. */
  sakura: () => {
    const blossoms: [number, number, number, number][] = [[600, 18, 1.2, 10], [560, 30, 1.4, 40], [522, 20, 1.1, 0], [492, 44, 1.3, 25], [458, 36, 1, 70], [430, 58, 1.2, 15], [404, 50, 0.9, 50], [540, 64, 1, 5], [575, 52, 0.9, 60], [470, 70, 0.8, 30]];
    return (
      <>
        <defs>
          <linearGradient id="bsk-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff1f5" /><stop offset="1" stopColor="#f7c3d6" /></linearGradient>
          <radialGradient id="bsk-petal" cx=".5" cy=".8" r=".9"><stop offset="0" stopColor="#ff9fbf" /><stop offset=".6" stopColor="#ffd5e3" /><stop offset="1" stopColor="#fff5f8" /></radialGradient>
        </defs>
        <rect width="600" height="200" fill="url(#bsk-bg)" />
        <circle cx="330" cy="86" r="48" fill="#f47a9b" opacity=".55" />
        <path d="M0 150L70 128L120 142L190 112L250 136L320 118L380 140L450 122L520 140L600 126V200H0Z" fill="#e6b3cc" opacity=".7" />
        <path d="M0 170L90 154L170 166L260 150L350 168L440 156L520 170L600 160V200H0Z" fill="#d498b8" opacity=".7" />
        <g stroke="#3a2230" strokeLinecap="round">
          <path d="M620 6C560 20 500 34 470 60S420 84 396 84" strokeWidth="6" fill="none" />
          <path d="M520 30C530 50 540 60 560 70" strokeWidth="3.4" fill="none" />
          <path d="M470 60C462 44 450 36 430 34" strokeWidth="3" fill="none" />
          <path d="M600 10C590 30 590 40 600 56" strokeWidth="2.6" fill="none" />
        </g>
        {blossoms.map(([x, y, s, rot], i) => (
          <g key={i} transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}>
            {Array.from({ length: 5 }, (_, k) => (
              <path key={k} transform={`rotate(${k * 72})`} d="M0 0C-4.6-2.6-5.6-9-2.2-11.4L0-9.6 2.2-11.4C5.6-9 4.6-2.6 0 0Z" fill="url(#bsk-petal)" stroke="#e87aa0" strokeWidth=".5" />
            ))}
            <circle r="2" fill="#c2185b" />
            {[0, 72, 144, 216, 288].map((a) => <circle key={a} cx={r1(3.4 * Math.sin((a * Math.PI) / 180))} cy={r1(-3.4 * Math.cos((a * Math.PI) / 180))} r=".7" fill="#ffd54f" />)}
          </g>
        ))}
        {Array.from({ length: 16 }, (_, i) => {
          const t = i / 15;
          const x = r1(560 - t * 380 + (rand(i + 3) - 0.5) * 80);
          const y = r1(70 + t * 90 + (rand(i + 7) - 0.5) * 50);
          return <path key={i} transform={`translate(${x} ${y}) rotate(${Math.round(rand(i + 11) * 360)}) scale(${r1(0.6 + rand(i + 17) * 0.6)})`} d="M0 0C-4-2.4-4.6-7.6-1.8-9.6L0-8 1.8-9.6C4.6-7.6 4-2.4 0 0Z" fill="#ffc2d6" stroke="#ef8fb1" strokeWidth=".5" opacity=".9" />;
        })}
        <Grain opacity={0.3} />
      </>
    );
  },

  /* Pastel fofo: adesivos colados (coração, estrela, nuvem, bola), com borda branca. */
  doce: () => {
    const STAR = "M0-11 3.2-3.6 11-3.4 4.8 1.6 7 9.4 0 4.8-7 9.4-4.8 1.6-11-3.4-3.2-3.6Z";
    return (
      <>
        <defs>
          <linearGradient id="bdo-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffd6e8" /><stop offset=".5" stopColor="#e9dcff" /><stop offset="1" stopColor="#cfeaff" /></linearGradient>
          <pattern id="bdo-check" width="24" height="24" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="#fff" opacity=".22" /><rect x="12" y="12" width="12" height="12" fill="#fff" opacity=".22" /></pattern>
          <linearGradient id="bdo-pink" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ff9cc8" /><stop offset="1" stopColor="#f0569b" /></linearGradient>
          <linearGradient id="bdo-yel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff2a8" /><stop offset="1" stopColor="#ffc93c" /></linearGradient>
          <linearGradient id="bdo-lil" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#d8c4ff" /><stop offset="1" stopColor="#9b7bff" /></linearGradient>
        </defs>
        <rect width="600" height="200" fill="url(#bdo-bg)" />
        <rect width="600" height="200" fill="url(#bdo-check)" />
        <g filter="url(#pb-drop)">
          <g transform="translate(330 70) rotate(-12) scale(3.2)">
            <path d={HEART} fill="#fff" stroke="#fff" strokeWidth="2.4" strokeLinejoin="round" />
            <path d={HEART} fill="url(#bdo-pink)" />
            <ellipse cx="-3" cy="-5" rx="1.6" ry="1" fill="#fff" opacity=".7" transform="rotate(-30 -3 -5)" />
          </g>
          <g transform="translate(450 118) rotate(14) scale(2)">
            <path d={STAR} fill="#fff" stroke="#fff" strokeWidth="4" strokeLinejoin="round" />
            <path d={STAR} fill="url(#bdo-yel)" stroke="#f5b400" strokeWidth=".6" strokeLinejoin="round" />
          </g>
          <g transform="translate(540 52) rotate(8)">
            <circle r="21" fill="#fff" />
            <Volleyball x={0} y={0} r={17} rot={10} />
          </g>
          <g transform="translate(230 34) rotate(-6) scale(1.7)">
            <path d="M-14 4a6 6 0 0 1 2-11 8 8 0 0 1 14-3 6 6 0 0 1 10 5 5 5 0 0 1-1 9Z" fill="#fff" stroke="#fff" strokeWidth="4" strokeLinejoin="round" />
            <path d="M-14 4a6 6 0 0 1 2-11 8 8 0 0 1 14-3 6 6 0 0 1 10 5 5 5 0 0 1-1 9Z" fill="#eaf6ff" stroke="#9cc9f0" strokeWidth=".7" />
          </g>
          <g transform="translate(378 150) rotate(-18) scale(1.6)">
            <path d={HEART} fill="#fff" stroke="#fff" strokeWidth="3.4" strokeLinejoin="round" />
            <path d={HEART} fill="url(#bdo-lil)" />
          </g>
          <g transform="translate(266 120) rotate(-10)">
            {["#ff8fb8", "#ffd36b", "#8fd6ff"].map((c, i) => <path key={c} d={`M${-26 + i * 6} 0A${26 - i * 6} ${26 - i * 6} 0 0 1 ${26 - i * 6} 0`} fill="none" stroke="#fff" strokeWidth="11" strokeLinecap="round" />)}
            {["#ff8fb8", "#ffd36b", "#8fd6ff"].map((c, i) => <path key={`c${c}`} d={`M${-26 + i * 6} 0A${26 - i * 6} ${26 - i * 6} 0 0 1 ${26 - i * 6} 0`} fill="none" stroke={c} strokeWidth="5" strokeLinecap="round" />)}
          </g>
          <g transform="translate(590 160) rotate(12) scale(1.2)">
            <path d={STAR} fill="#fff" stroke="#fff" strokeWidth="4" strokeLinejoin="round" />
            <path d={STAR} fill="#b9f3d6" stroke="#5cc99a" strokeWidth=".6" strokeLinejoin="round" />
          </g>
        </g>
        <Twinkle x={404} y={44} s={1.1} fill="#fff" />
        <Twinkle x={580} y={140} s={0.9} fill="#fff" />
        <Twinkle x={272} y={110} s={0.7} fill="#fff" />
        <Grain opacity={0.25} />
      </>
    );
  },

  /* Synthwave: sol listrado, montanhas em neon e grade brilhando. */
  neon: () => (
    <>
      <defs>
        <linearGradient id="bn-sun" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fde047" /><stop offset=".5" stopColor="#fb7185" /><stop offset="1" stopColor="#c026d3" /></linearGradient>
        <linearGradient id="bn-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#090418" /><stop offset="1" stopColor="#2a0a52" /></linearGradient>
        <linearGradient id="bn-floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2a0a52" /><stop offset="1" stopColor="#0b0420" /></linearGradient>
        <clipPath id="bn-c"><rect y="20" width="600" height="92" /></clipPath>
      </defs>
      <rect width="600" height="200" fill="url(#bn-bg)" />
      <Stars n={40} y1={90} seed={21} color="#a5f3fc" />
      <circle cx="380" cy="80" r="74" fill="#ff4fd8" opacity=".25" filter="url(#pb-blur)" />
      <g clipPath="url(#bn-c)">
        <circle cx="380" cy="80" r="60" fill="url(#bn-sun)" />
        {[66, 76, 85, 93, 100, 106].map((y, i) => <rect key={y} x="310" y={y} width="140" height={r1(1.2 + i * 0.9)} fill="#1b0636" />)}
      </g>
      <path d="M0 112L60 82L100 98L150 66L210 104L240 92L280 112Z" fill="#14052c" stroke="#ff4fd8" strokeWidth="1.4" filter="url(#pb-glow)" />
      <path d="M440 112L490 88L520 98L560 74L600 92V112Z" fill="#14052c" stroke="#22d3ee" strokeWidth="1.2" filter="url(#pb-glow)" />
      <rect y="112" width="600" height="88" fill="url(#bn-floor)" />
      <g stroke="#22d3ee" strokeWidth="1.3" opacity=".85" filter="url(#pb-glow)">
        {Array.from({ length: 21 }, (_, i) => <line key={i} x1="380" y1="112" x2={-620 + i * 100} y2="210" />)}
        {[118, 127, 139, 156, 180].map((y) => <rect key={y} x="0" y={y} width="600" height="1.2" fill="#22d3ee" stroke="none" />)}
      </g>
      <rect y="111" width="600" height="2.4" fill="#ff8af0" />
      <g fill="none" stroke="#f0abfc" strokeWidth="2.2" filter="url(#pb-glow)">
        <circle cx="530" cy="148" r="15" />
        <path d="M515 148Q530 136 545 148M519 158Q530 145 541 158" />
      </g>
      <Grain opacity={0.35} />
    </>
  ),

  /* Noite de estrelas: lua, quadrinha de areia acesa por um refletor. */
  noite: () => (
    <>
      <defs>
        <linearGradient id="bno-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#040821" /><stop offset=".65" stopColor="#17154a" /><stop offset="1" stopColor="#3b1f6e" /></linearGradient>
        <radialGradient id="bno-moon"><stop offset="0" stopColor="#fff8d8" stopOpacity=".55" /><stop offset="1" stopColor="#fff8d8" stopOpacity="0" /></radialGradient>
        <linearGradient id="bno-cone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff2c2" stopOpacity=".5" /><stop offset="1" stopColor="#fff2c2" stopOpacity="0" /></linearGradient>
        <radialGradient id="bno-pool"><stop offset="0" stopColor="#ffe9b0" stopOpacity=".55" /><stop offset="1" stopColor="#ffe9b0" stopOpacity="0" /></radialGradient>
      </defs>
      <rect width="600" height="200" fill="url(#bno-sky)" />
      <path d="M80 0Q300 80 600 30V60Q300 110 80 30Z" fill="#a5b4fc" opacity=".08" filter="url(#pb-blur)" />
      <Stars n={90} y1={130} seed={11} />
      <Twinkle x={150} y={30} s={0.8} />
      <Twinkle x={360} y={22} s={0.6} />
      <circle cx="500" cy="46" r="48" fill="url(#bno-moon)" />
      <circle cx="500" cy="46" r="17" fill="#fff6d2" />
      <circle cx="494" cy="42" r="3" fill="#e9dcae" opacity=".7" /><circle cx="505" cy="52" r="2.2" fill="#e9dcae" opacity=".7" /><circle cx="506" cy="38" r="1.4" fill="#e9dcae" opacity=".7" />
      <path d="M0 140Q90 112 190 136T380 128T600 138V200H0Z" fill="#100b33" />
      <path d="M0 162Q160 144 330 160T600 156V200H0Z" fill="#090624" />
      <line x1="250" y1="160" x2="250" y2="88" stroke="#2a2550" strokeWidth="3" />
      <rect x="242" y="84" width="16" height="6" rx="2" fill="#3a3466" />
      <rect x="244" y="89" width="12" height="2" fill="#fff6d2" />
      <polygon points="244,90 256,90 360,166 230,166" fill="url(#bno-cone)" />
      <ellipse cx="320" cy="164" rx="90" ry="14" fill="url(#bno-pool)" />
      <Net x={268} y={132} w={110} h={16} base={166} antennas={false} opacity={0.9} />
      <FloorShadow x={350} y={170} rx={8} />
      <Volleyball x={350} y={163} r={7} rot={40} />
      <Grain opacity={0.4} />
    </>
  ),

  /* Rede tropical: palmeiras procedurais, hibisco e luz de verão. */
  tropical: () => (
    <>
      <defs>
        <linearGradient id="bt-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff4c4" /><stop offset=".55" stopColor="#b6f0d6" /><stop offset="1" stopColor="#5ccaa5" /></linearGradient>
        <radialGradient id="bt-sun"><stop offset="0" stopColor="#fff" stopOpacity=".9" /><stop offset="1" stopColor="#fff7c2" stopOpacity="0" /></radialGradient>
      </defs>
      <rect width="600" height="200" fill="url(#bt-bg)" />
      <circle cx="360" cy="20" r="100" fill="url(#bt-sun)" />
      <g fill="#fff" opacity=".18">{Array.from({ length: 9 }, (_, i) => <polygon key={i} points={`360,0 ${200 + i * 45},210 ${222 + i * 45},210`} />)}</g>
      <path d="M0 160Q150 148 300 162T600 154V200H0Z" fill="#f7d488" />
      <Net x={290} y={118} w={170} h={22} base={168} antennas={false} />
      <Volleyball x={384} y={78} r={12} rot={-10} />
      <Trail d="M300 110Q330 64 372 76" color="#0f766e" opacity={0.35} />
      <Frond x={-10} y={-10} angle={40} len={110} color="#0f6b3e" width={2.6} />
      <Frond x={-10} y={30} angle={10} len={100} color="#15803d" width={2.6} />
      <Frond x={-10} y={-20} angle={75} len={90} color="#166534" width={2.4} />
      <Frond x={610} y={-10} angle={140} len={110} color="#0f6b3e" width={2.6} />
      <Frond x={610} y={40} angle={170} len={96} color="#15803d" width={2.6} />
      <Frond x={610} y={-20} angle={110} len={86} color="#166534" width={2.4} />
      <g transform="translate(552 128)">
        {Array.from({ length: 5 }, (_, k) => <path key={k} transform={`rotate(${k * 72})`} d="M0 0C-7-4-8-14-2-16 0-15 2-15 2-16 8-14 7-4 0 0Z" fill="#f43f5e" stroke="#be123c" strokeWidth=".6" />)}
        <path d="M0 0L5-12" stroke="#fde047" strokeWidth="1.2" />
        <circle cx="5" cy="-12" r="1.6" fill="#fde047" />
      </g>
      <Grain opacity={0.3} />
    </>
  ),

  /* Tempestade: nuvens pesadas, raio com galhos, chuva e a quadra acesa no clarão. */
  trovoada: () => (
    <>
      <defs>
        <linearGradient id="btr-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#090d1c" /><stop offset="1" stopColor="#232c48" /></linearGradient>
        <radialGradient id="btr-flash" cx=".6" cy=".35" r=".45"><stop offset="0" stopColor="#c7d2fe" stopOpacity=".55" /><stop offset="1" stopColor="#c7d2fe" stopOpacity="0" /></radialGradient>
      </defs>
      <rect width="600" height="200" fill="url(#btr-bg)" />
      <rect width="600" height="200" fill="url(#btr-flash)" />
      <g filter="url(#pb-soft)">
        <ellipse cx="80" cy="20" rx="150" ry="46" fill="#151b30" />
        <ellipse cx="300" cy="10" rx="170" ry="44" fill="#1a2138" />
        <ellipse cx="500" cy="22" rx="170" ry="50" fill="#151b30" />
        <ellipse cx="360" cy="40" rx="110" ry="20" fill="#3b4670" opacity=".8" />
        <ellipse cx="200" cy="44" rx="90" ry="14" fill="#2b3456" opacity=".8" />
      </g>
      <g stroke="#94a3b8" strokeWidth=".9" opacity=".3">
        {Array.from({ length: 60 }, (_, i) => {
          const x = r1(rand(i + 5) * 640);
          const y = r1(50 + rand(i + 50) * 130);
          return <line key={i} x1={x} y1={y} x2={x - 6} y2={y + 16} />;
        })}
      </g>
      <Lightning from={[372, 36]} to={[350, 150]} seed={3} />
      <path d="M0 176H600V200H0Z" fill="#0b0f1f" />
      <ellipse cx="350" cy="176" rx="120" ry="6" fill="#c7d2fe" opacity=".18" filter="url(#pb-soft)" />
      <Net x={420} y={140} w={130} h={16} base={178} dark antennas={false} />
      <Grain opacity={0.45} />
    </>
  ),

  /* Fornalha: chamas em camadas, faíscas e uma bola pegando fogo. */
  fornalha: () => (
    <>
      <defs>
        <linearGradient id="bf-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#140403" /><stop offset=".6" stopColor="#4a0d07" /><stop offset="1" stopColor="#b5300c" /></linearGradient>
        <linearGradient id="bf-1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#b91c1c" /><stop offset="1" stopColor="#7f1d1d" /></linearGradient>
        <linearGradient id="bf-2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f97316" /><stop offset="1" stopColor="#c2410c" /></linearGradient>
        <linearGradient id="bf-3" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fde047" /><stop offset="1" stopColor="#fb923c" /></linearGradient>
        <linearGradient id="bf-comet" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stopColor="#fff7c2" /><stop offset=".3" stopColor="#fbbf24" /><stop offset=".7" stopColor="#ea580c" stopOpacity=".6" /><stop offset="1" stopColor="#ea580c" stopOpacity="0" /></linearGradient>
      </defs>
      <rect width="600" height="200" fill="url(#bf-bg)" />
      <rect y="120" width="600" height="80" fill="#f97316" opacity=".35" filter="url(#pb-blur)" />
      <path d={flameRow(150, 80, 9, 3)} fill="url(#bf-1)" opacity=".85" filter="url(#pb-soft)" />
      <path d={flameRow(168, 62, 11, 17)} fill="url(#bf-2)" />
      <path d={flameRow(186, 40, 14, 41)} fill="url(#bf-3)" />
      <path d={flameRow(198, 22, 18, 63)} fill="#fff3b0" opacity=".85" />
      <g transform="rotate(-24 430 74)">
        <path d="M430 60C380 58 320 66 250 74 320 82 380 90 430 88Z" fill="url(#bf-comet)" filter="url(#pb-soft)" />
        <path d="M430 66C392 66 350 70 300 74 350 78 392 82 430 82Z" fill="#fff3b0" opacity=".7" filter="url(#pb-soft)" />
      </g>
      <circle cx="430" cy="74" r="26" fill="#fb923c" opacity=".45" filter="url(#pb-blur)" />
      <Volleyball x={430} y={74} r={16} rot={30} />
      {Array.from({ length: 30 }, (_, i) => <circle key={i} cx={r1(rand(i + 9) * 600)} cy={r1(20 + rand(i + 60) * 130)} r={r1(0.6 + rand(i + 90) * 1.6)} fill="#fde68a" opacity={r1(0.35 + rand(i + 120) * 0.6)} />)}
      <Grain opacity={0.4} />
    </>
  ),

  /* Arena lotada: canhões de luz cruzando, torcida com lanterna do celular. */
  arena: () => (
    <>
      <defs>
        <linearGradient id="ba-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#05030f" /><stop offset="1" stopColor="#1d1047" /></linearGradient>
        <linearGradient id="ba-beam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#e9e3ff" stopOpacity=".42" /><stop offset="1" stopColor="#e9e3ff" stopOpacity="0" /></linearGradient>
        <linearGradient id="ba-floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#c27a3e" /><stop offset="1" stopColor="#7a431b" /></linearGradient>
      </defs>
      <rect width="600" height="200" fill="url(#ba-bg)" />
      <g filter="url(#pb-soft)">
        <polygon points="40,0 64,0 420,170 330,170" fill="url(#ba-beam)" />
        <polygon points="536,0 560,0 270,170 180,170" fill="url(#ba-beam)" />
        <polygon points="292,0 308,0 360,170 240,170" fill="url(#ba-beam)" opacity=".7" />
      </g>
      {[52, 300, 548].map((x) => <ellipse key={x} cx={x} cy="2" rx="16" ry="5" fill="#fffbea" />)}
      {Array.from({ length: 4 }, (_, row) => (
        <g key={row} fill={["#1a0f3d", "#21134b", "#2a1860", "#341d75"][row]}>
          {Array.from({ length: 34 }, (_, i) => {
            const x = r1(i * 18 + (row % 2) * 9 + (rand(row * 40 + i) - 0.5) * 4);
            const y = 96 + row * 12;
            return <path key={i} d={`M${x - 7} ${y + 10}Q${x - 7} ${y + 1} ${x} ${y + 1}Q${x + 7} ${y + 1} ${x + 7} ${y + 10}ZM${x} ${y - 4}m-3.6 0a3.6 3.6 0 1 0 7.2 0a3.6 3.6 0 1 0-7.2 0`} />;
          })}
        </g>
      ))}
      {Array.from({ length: 16 }, (_, i) => <circle key={i} cx={r1(rand(i + 3) * 600)} cy={r1(92 + rand(i + 30) * 40)} r="1.3" fill="#fff" filter="url(#pb-soft)" opacity=".9" />)}
      {Array.from({ length: 16 }, (_, i) => <circle key={`c${i}`} cx={r1(rand(i + 3) * 600)} cy={r1(92 + rand(i + 30) * 40)} r=".7" fill="#fff" />)}
      <path d="M0 144H600V200H0Z" fill="url(#ba-floor)" />
      <ellipse cx="300" cy="160" rx="200" ry="16" fill="#ffe8c4" opacity=".3" filter="url(#pb-soft)" />
      <Net x={230} y={128} w={140} h={14} base={162} />
      <Vignette opacity={0.4} />
      <Grain opacity={0.4} />
    </>
  ),

  /* Pódio dourado: holofote, troféu de metal, medalhas e confete em jatos. */
  podio: () => (
    <>
      <defs>
        <linearGradient id="bpo-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2a0a52" /><stop offset="1" stopColor="#120630" /></linearGradient>
        <linearGradient id="bpo-spot" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff2c2" stopOpacity=".5" /><stop offset="1" stopColor="#fff2c2" stopOpacity="0" /></linearGradient>
        <linearGradient id="bpo-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff3b0" /><stop offset=".45" stopColor="#f5c542" /><stop offset="1" stopColor="#a8670a" /></linearGradient>
        <linearGradient id="bpo-front" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#4c2a8c" /><stop offset="1" stopColor="#24124f" /></linearGradient>
      </defs>
      <rect width="600" height="200" fill="url(#bpo-bg)" />
      <polygon points="410,0 430,0 520,170 320,170" fill="url(#bpo-spot)" filter="url(#pb-soft)" />
      {([[330, 112, "#d6dbe4"], [400, 92, "url(#bpo-gold)"], [470, 124, "#d0874a"]] as const).map(([x, y, top], i) => (
        <g key={i}>
          <rect x={x} y={y} width="62" height={200 - y} fill="url(#bpo-front)" />
          <rect x={x} y={y - 6} width="62" height="7" fill={top} />
          <circle cx={x + 31} cy={y + 22} r="9" fill={top} stroke="#1a0b3d" strokeWidth="1" />
          <path d={`M${x + 25} ${y + 4}L${x + 31} ${y + 13}L${x + 37} ${y + 4}`} fill="none" stroke="#7c3aed" strokeWidth="2.4" />
        </g>
      ))}
      <g transform="translate(431 46)" filter="url(#pb-drop)">
        <path d="M-17-16H17V-2C17 14 9 22 0 23-9 22-17 14-17-2Z" fill="url(#bpo-gold)" />
        <path d="M-17-12H-26C-27 2-20 8-12 9M17-12H26C27 2 20 8 12 9" fill="none" stroke="#e8b33a" strokeWidth="3" />
        <path d="M-4 23H4L6 33H-6Z" fill="#d9a23a" />
        <rect x="-13" y="33" width="26" height="7" rx="2" fill="#8a5a12" />
        <path d="M-11-14C-11 4-6 12 0 16" fill="none" stroke="#fffbe0" strokeWidth="2" opacity=".6" />
      </g>
      {Array.from({ length: 46 }, (_, i) => {
        const left = i % 2 === 0;
        const t = rand(i + 2);
        const x = r1(left ? 250 + t * 170 + rand(i + 9) * 30 : 610 - t * 170 - rand(i + 9) * 30);
        const y = r1(4 + t * 110 + (rand(i + 5) - 0.5) * 30);
        return <rect key={i} x={x} y={y} width="4" height="8" rx="1" fill={["#f0abfc", "#fde047", "#38bdf8", "#fb7185", "#a7f3d0"][i % 5]} opacity=".9" transform={`rotate(${Math.round(rand(i + 140) * 180)} ${x} ${y})`} />;
      })}
      <Vignette opacity={0.4} />
      <Grain opacity={0.4} />
    </>
  ),

  /* Galáxia: nebulosa e um planeta que é uma bola de vôlei, com anéis. */
  galaxia: () => (
    <>
      <defs>
        <radialGradient id="bg-bg" cx=".7" cy=".5" r=".9"><stop offset="0" stopColor="#3b0f6e" /><stop offset=".55" stopColor="#13063a" /><stop offset="1" stopColor="#02010a" /></radialGradient>
        <radialGradient id="bg-night" cx=".3" cy=".3" r=".9"><stop offset=".45" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#05010f" stopOpacity=".8" /></radialGradient>
      </defs>
      <rect width="600" height="200" fill="url(#bg-bg)" />
      <g filter="url(#pb-blur)" opacity=".7">
        <ellipse cx="360" cy="80" rx="140" ry="40" fill="#c026d3" opacity=".5" transform="rotate(-16 360 80)" />
        <ellipse cx="470" cy="130" rx="120" ry="30" fill="#2563eb" opacity=".5" transform="rotate(-16 470 130)" />
        <ellipse cx="260" cy="40" rx="80" ry="20" fill="#7c3aed" opacity=".6" />
      </g>
      <Stars n={120} y1={200} seed={31} max={1.6} />
      <Twinkle x={300} y={60} s={1} />
      <Twinkle x={560} y={30} s={0.7} />
      <path d="M394 112A76 18 -14 0 1 546 76" fill="none" stroke="#f5d0fe" strokeWidth="5" opacity=".55" />
      <g transform="translate(470 96)">
        <Volleyball x={0} y={0} r={44} rot={25} />
        <circle r="44" fill="url(#bg-night)" />
      </g>
      <path d="M394 112A76 18 -14 0 0 546 76" fill="none" stroke="#f5d0fe" strokeWidth="5" opacity=".9" />
      <path d="M390 116A82 21 -14 0 0 552 74" fill="none" stroke="#c084fc" strokeWidth="1.4" opacity=".7" />
      <circle cx="250" cy="120" r="9" fill="#fda4af" />
      <circle cx="250" cy="120" r="9" fill="url(#bg-night)" />
      <Grain opacity={0.4} />
    </>
  ),

  /* Lenda do VPA: art déco em preto e ouro, coroa no arco escalonado. */
  lendario: () => (
    <>
      <defs>
        <linearGradient id="bl-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0b0906" /><stop offset="1" stopColor="#1d160a" /></linearGradient>
        <linearGradient id="bl-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff1b8" /><stop offset=".5" stopColor="#e2a92b" /><stop offset="1" stopColor="#8a5a0c" /></linearGradient>
      </defs>
      <rect width="600" height="200" fill="url(#bl-bg)" />
      <g stroke="#d4a332" strokeWidth=".8" opacity=".35">
        {Array.from({ length: 31 }, (_, i) => {
          const a = Math.PI + (i / 30) * Math.PI;
          const len = i % 2 ? 150 : 210;
          return <line key={i} x1="420" y1="200" x2={r1(420 + Math.cos(a) * len)} y2={r1(200 + Math.sin(a) * len)} />;
        })}
      </g>
      <g fill="none" stroke="url(#bl-gold)">
        <path d="M360 200V92H372V72H384V56H456V72H468V92H480V200" strokeWidth="2.2" />
        <path d="M368 200V98H380V78H392V64H448V78H460V98H472V200" strokeWidth=".9" />
        {[30, 42, 54].map((r) => <path key={r} d={`M${300 - r} 200A${r} ${r} 0 0 1 ${300 + r} 200`} strokeWidth="1" opacity=".6" />)}
        {[30, 42, 54].map((r) => <path key={`b${r}`} d={`M${540 - r} 200A${r} ${r} 0 0 1 ${540 + r} 200`} strokeWidth="1" opacity=".6" />)}
      </g>
      <rect y="6" width="600" height="1.4" fill="#d4a332" opacity=".6" />
      <rect y="10" width="600" height=".6" fill="#d4a332" opacity=".6" />
      <g transform="translate(420 112)" filter="url(#pb-drop)">
        <path d="M-30 6-36-28-18-12 0-36 18-12 36-28 30 6Z" fill="url(#bl-gold)" stroke="#7a4f0a" strokeWidth="1.2" strokeLinejoin="round" />
        <rect x="-31" y="6" width="62" height="10" rx="2" fill="url(#bl-gold)" stroke="#7a4f0a" strokeWidth="1" />
        <circle cx="0" cy="11" r="3" fill="#7c3aed" /><circle cx="-16" cy="11" r="2.2" fill="#e5334b" /><circle cx="16" cy="11" r="2.2" fill="#e5334b" />
        {[[-36, -28], [0, -36], [36, -28]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="3.2" fill="#fff4c4" stroke="#a8670a" strokeWidth=".8" />)}
        <path d="M-24 2-26-16-14-6" fill="none" stroke="#fffbe0" strokeWidth="1.4" opacity=".6" />
      </g>
      <Twinkle x={470} y={44} s={1} fill="#ffe9a8" />
      <Twinkle x={366} y={140} s={0.7} fill="#ffe9a8" opacity={0.7} />
      <Stars n={20} y1={190} seed={51} color="#f5d27a" max={1} />
      <Grain opacity={0.45} />
    </>
  ),

  /* Cidade à noite: três camadas de prédios e a bola fazendo de lua. */
  cidade: () => {
    const layer = (seed: number, base: number, minH: number, maxH: number, color: string, windows: number) => {
      const out: ReactNode[] = [];
      let x = -10;
      let i = 0;
      while (x < 610) {
        const w = Math.round(26 + rand(seed + i) * 34);
        const h = Math.round(minH + rand(seed + i + 50) * (maxH - minH));
        out.push(<rect key={`b${i}`} x={x} y={base - h} width={w} height={h + 60} fill={color} />);
        if (rand(seed + i + 90) > 0.6) out.push(<rect key={`t${i}`} x={x + w / 2 - 0.6} y={base - h - 10} width="1.2" height="10" fill={color} />);
        if (windows) {
          for (let r = 0; r < Math.floor(h / 9); r++) {
            for (let c = 0; c < Math.floor((w - 6) / 7); c++) {
              if (rand(seed * 3 + i * 31 + r * 7 + c) > 1 - windows) out.push(<rect key={`w${i}-${r}-${c}`} x={x + 4 + c * 7} y={base - h + 5 + r * 9} width="3" height="4" fill="#ffd98a" opacity=".85" />);
            }
          }
        }
        x += w + 2;
        i++;
      }
      return out;
    };
    return (
      <>
        <defs>
          <linearGradient id="bci-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0b0a2b" /><stop offset=".6" stopColor="#3b1a73" /><stop offset="1" stopColor="#b03a7a" /></linearGradient>
          <radialGradient id="bci-moon"><stop offset="0" stopColor="#ffe9f4" stopOpacity=".5" /><stop offset="1" stopColor="#ffe9f4" stopOpacity="0" /></radialGradient>
        </defs>
        <rect width="600" height="200" fill="url(#bci-sky)" />
        <Stars n={40} y1={80} seed={13} />
        <circle cx="470" cy="50" r="70" fill="url(#bci-moon)" />
        <Volleyball x={470} y={50} r={24} rot={-15} />
        <g opacity=".55">{layer(5, 130, 20, 50, "#5b2a8a", 0)}</g>
        <rect y="100" width="600" height="40" fill="#b03a7a" opacity=".18" filter="url(#pb-soft)" />
        {layer(17, 150, 26, 70, "#1f0f45", 0.22)}
        {layer(29, 172, 14, 40, "#0b0620", 0.15)}
        <Grain opacity={0.4} />
      </>
    );
  },

  /* Ginásio de dia: janelões, luz entrando, placar e bandeirinhas. */
  ginasio: () => (
    <>
      <defs>
        <linearGradient id="bgi-wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#d9dff2" /><stop offset="1" stopColor="#aab4d6" /></linearGradient>
        <linearGradient id="bgi-floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#c98a4a" /><stop offset="1" stopColor="#e8b077" /></linearGradient>
        <linearGradient id="bgi-shaft" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fffbe8" stopOpacity=".7" /><stop offset="1" stopColor="#fffbe8" stopOpacity="0" /></linearGradient>
      </defs>
      <rect width="600" height="200" fill="url(#bgi-wall)" />
      {[60, 180, 300].map((x) => (
        <g key={x}>
          <rect x={x} y="22" width="90" height="42" fill="#eef6ff" stroke="#7c86ad" strokeWidth="3" />
          <path d={`M${x + 30} 22V64M${x + 60} 22V64M${x} 43H${x + 90}`} stroke="#7c86ad" strokeWidth="1.6" />
          <polygon points={`${x},64 ${x + 90},64 ${x + 170},150 ${x + 80},150`} fill="url(#bgi-shaft)" />
        </g>
      ))}
      <rect y="72" width="600" height="10" fill="#6d28d9" />
      <rect y="84" width="600" height="3" fill="#facc15" />
      <path d="M0 3Q75 12 150 3T300 3T450 3T600 3" fill="none" stroke="#475569" strokeWidth=".8" />
      {Array.from({ length: 30 }, (_, i) => {
        const x = 2 + i * 20;
        const y = r1(3 + Math.sin(((x % 150) * Math.PI) / 150) * 4.5);
        return <path key={i} d={`M${x} ${y}h9l-4.5 8Z`} fill={["#7c3aed", "#facc15", "#2563eb", "#ef4444"][i % 4]} />;
      })}
      <g transform="translate(440 18)">
        <rect width="120" height="46" rx="4" fill="#111827" stroke="#374151" strokeWidth="2" />
        <Digit x={10} y={9} d="2" color="#fbbf24" s={1.8} />
        <Digit x={28} y={9} d="5" color="#fbbf24" s={1.8} />
        <rect x="56" y="18" width="8" height="2.4" fill="#f87171" />
        <Digit x={74} y={9} d="2" color="#fbbf24" s={1.8} />
        <Digit x={92} y={9} d="3" color="#fbbf24" s={1.8} />
      </g>
      <rect y="120" width="600" height="80" fill="url(#bgi-floor)" />
      <g stroke="#7a4a1e" strokeWidth=".6" opacity=".3">{Array.from({ length: 30 }, (_, i) => <line key={i} x1={i * 22 - 20} y1="120" x2={i * 22 - 60} y2="200" />)}</g>
      {[100, 220, 340].map((x) => <rect key={x} x={x + 30} y="122" width="50" height="60" fill="#fffbe8" opacity=".18" filter="url(#pb-soft)" />)}
      <line x1="0" y1="150" x2="600" y2="150" stroke="#fff" strokeWidth="2" opacity=".7" />
      <Net x={220} y={92} w={240} h={24} base={152} />
      <FloorShadow x={500} y={168} rx={12} />
      <Volleyball x={500} y={158} r={11} rot={60} />
      <Grain opacity={0.3} />
    </>
  ),

  /* Aurora boreal: cortinas de luz, montanhas nevadas e o lago espelhando. */
  aurora: () => (
    <>
      <defs>
        <linearGradient id="bau-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#020617" /><stop offset="1" stopColor="#0d2747" /></linearGradient>
        <linearGradient id="bau-a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#34d399" stopOpacity="0" /><stop offset=".6" stopColor="#34d399" stopOpacity=".75" /><stop offset="1" stopColor="#a7f3d0" stopOpacity=".1" /></linearGradient>
        <linearGradient id="bau-b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#e879f9" stopOpacity="0" /><stop offset=".6" stopColor="#c084fc" stopOpacity=".6" /><stop offset="1" stopColor="#38bdf8" stopOpacity="0" /></linearGradient>
        <pattern id="bau-stri" width="6" height="200" patternUnits="userSpaceOnUse"><rect width="2" height="200" fill="#000" opacity=".25" /></pattern>
      </defs>
      <rect width="600" height="200" fill="url(#bau-sky)" />
      <Stars n={80} y1={120} seed={23} />
      <g filter="url(#pb-soft)">
        <path d="M60 110C120 40 220 30 300 70S470 40 560 10L600 30C520 70 440 110 340 100S160 80 100 130Z" fill="url(#bau-a)" />
        <path d="M200 120C260 80 340 60 420 86S540 70 600 60V100C520 110 460 130 380 120S260 110 220 140Z" fill="url(#bau-b)" />
      </g>
      <rect width="600" height="140" fill="url(#bau-stri)" opacity=".5" />
      <path d="M0 150L70 108L120 132L190 96L260 138L330 112L400 146L470 100L540 132L600 112V150Z" fill="#0b1730" />
      {([[[120, 132], [190, 96], [260, 138]], [[400, 146], [470, 100], [540, 132]], [[0, 150], [70, 108], [120, 132]], [[260, 138], [330, 112], [400, 146]]] as [Pt, Pt, Pt][]).map(([l, p, r], i) => {
        const k = i < 2 ? 0.36 : 0.28;
        const a: Pt = [r1(p[0] + (l[0] - p[0]) * k), r1(p[1] + (l[1] - p[1]) * k)];
        const b: Pt = [r1(p[0] + (r[0] - p[0]) * k), r1(p[1] + (r[1] - p[1]) * k)];
        const lerp = (f: number, dy: number): Pt => [r1(a[0] + (b[0] - a[0]) * f), r1(a[1] + (b[1] - a[1]) * f + dy)];
        return <path key={i} d={`${poly([p, a, lerp(0.22, -3), lerp(0.42, 2), lerp(0.62, -3.5), lerp(0.8, 1.5), b])}Z`} fill="#e2e8f0" opacity=".85" />;
      })}
      <rect y="150" width="600" height="50" fill="#06142a" />
      <g opacity=".35" transform="translate(0 300) scale(1 -1)" filter="url(#pb-soft)">
        <path d="M0 150L70 108L120 132L190 96L260 138L330 112L400 146L470 100L540 132L600 112V150Z" fill="#0f2a4a" />
        <path d="M200 120C260 80 340 60 420 86S540 70 600 60V100C520 110 460 130 380 120S260 110 220 140Z" fill="#34d399" opacity=".5" />
      </g>
      <rect y="150" width="600" height="1" fill="#a7f3d0" opacity=".25" />
      <Grain opacity={0.4} />
    </>
  ),

  /* Logo em neon: tubos de luz em volta e grade no chão. */
  "logo-neon": (logos) => (
    <>
      <defs>
        <radialGradient id="bln-bg" cx=".55" cy=".5" r=".7"><stop offset="0" stopColor="#3b1170" /><stop offset="1" stopColor="#06021a" /></radialGradient>
        <filter id="bln-blur" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="8" /></filter>
      </defs>
      <rect width="600" height="200" fill="url(#bln-bg)" />
      <Stars n={30} y1={140} seed={77} color="#f5d0fe" />
      <g stroke="#a21caf" strokeWidth="1" opacity=".5">{Array.from({ length: 13 }, (_, i) => <line key={i} x1={400} y1={150} x2={-200 + i * 100} y2={205} />)}</g>
      <rect y="149" width="600" height="1.6" fill="#e879f9" opacity=".8" />
      <g fill="none" filter="url(#pb-glow)">
        <circle cx="400" cy="90" r="82" stroke="#e879f9" strokeWidth="2.6" />
        <circle cx="400" cy="90" r="96" stroke="#22d3ee" strokeWidth="1.6" strokeDasharray="40 10 4 10" />
      </g>
      <image href={logos.white} x="318" y="22" width="164" height="136" filter="url(#bln-blur)" opacity=".85" />
      <image href={logos.white} x="318" y="22" width="164" height="136" />
      <Grain opacity={0.35} />
    </>
  ),

  /* Logo dourada: raios de ouro e moldura art déco. */
  "logo-dourado": (logos) => (
    <>
      <defs>
        <linearGradient id="bld-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#0a0906" /><stop offset="1" stopColor="#21180a" /></linearGradient>
        <linearGradient id="bld-y" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff1b0" /><stop offset=".5" stopColor="#f0b429" /><stop offset="1" stopColor="#8a560c" /></linearGradient>
        <radialGradient id="bld-glow"><stop offset="0" stopColor="#f0b429" stopOpacity=".35" /><stop offset="1" stopColor="#f0b429" stopOpacity="0" /></radialGradient>
      </defs>
      <rect width="600" height="200" fill="url(#bld-bg)" />
      <g fill="#f0b429">
        {Array.from({ length: 24 }, (_, i) => {
          const a1 = (i / 24) * Math.PI * 2;
          const a2 = a1 + 0.07;
          return <polygon key={i} points={`410,96 ${r1(410 + Math.cos(a1) * 360)},${r1(96 + Math.sin(a1) * 360)} ${r1(410 + Math.cos(a2) * 360)},${r1(96 + Math.sin(a2) * 360)}`} opacity={i % 2 ? 0.06 : 0.12} />;
        })}
      </g>
      <circle cx="410" cy="96" r="120" fill="url(#bld-glow)" />
      <g fill="none" stroke="url(#bld-y)">
        <circle cx="410" cy="96" r="84" strokeWidth="3.4" />
        <circle cx="410" cy="96" r="92" strokeWidth="1" opacity=".7" />
        <circle cx="410" cy="96" r="76" strokeWidth=".8" strokeDasharray="1 4" opacity=".8" />
      </g>
      {[0, 90, 180, 270].map((deg) => <Twinkle key={deg} x={r1(410 + Math.sin((deg * Math.PI) / 180) * 92)} y={r1(96 - Math.cos((deg * Math.PI) / 180) * 92)} s={0.8} fill="#fff1b0" />)}
      <image href={logos.white} x="342" y="40" width="136" height="112" filter="url(#pb-drop)" />
      <Stars n={26} y1={200} seed={91} color="#fde68a" max={1} />
      <Grain opacity={0.45} />
    </>
  ),
};

export function ProfileBannerArt({ id, className = "", logos = DEFAULT_LOGOS }: { id: BannerId; className?: string; logos?: BannerLogos }) {
  const draw = ART[id];
  if (!draw) return null;
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={`block h-full w-full ${className}`} viewBox="0 0 600 200" preserveAspectRatio="xMidYMid slice" aria-hidden focusable="false">
      <SharedDefs />
      {draw(logos)}
    </svg>
  );
}
