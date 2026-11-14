import type { ReactNode } from "react";
import type { BannerId } from "@/lib/cosmetics";

/**
 * Capas do cartão de perfil. Tudo em SVG (600x200, corta nas bordas), sem
 * imagem externa: leve, nítido em qualquer tela e sem custo de rede.
 */

/** Pseudo-aleatório determinístico: a arte é igual em servidor e navegador. */
function rand(seed: number) {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

function Stars({ n, yMax, seed = 1, color = "#fff", max = 1.6 }: { n: number; yMax: number; seed?: number; color?: string; max?: number }) {
  return (
    <>
      {Array.from({ length: n }, (_, i) => (
        <circle key={i} cx={Math.round(rand(seed + i) * 600)} cy={Math.round(rand(seed + i + 100) * yMax)} r={+(0.5 + rand(seed + i + 200) * max).toFixed(2)} fill={color} opacity={+(0.35 + rand(seed + i + 300) * 0.65).toFixed(2)} />
      ))}
    </>
  );
}

function Net({ x, y, w, h, color = "#fff", opacity = 0.7 }: { x: number; y: number; w: number; h: number; color?: string; opacity?: number }) {
  const cols = Math.round(w / 10);
  const rows = Math.round(h / 10);
  return (
    <g stroke={color} strokeWidth={0.8} opacity={opacity} fill="none">
      {Array.from({ length: cols + 1 }, (_, i) => <line key={`v${i}`} x1={x + (w / cols) * i} y1={y} x2={x + (w / cols) * i} y2={y + h} />)}
      {Array.from({ length: rows + 1 }, (_, i) => <line key={`h${i}`} x1={x} y1={y + (h / rows) * i} x2={x + w} y2={y + (h / rows) * i} />)}
      <rect x={x} y={y - 2} width={w} height={4} fill={color} stroke="none" opacity={0.9} />
    </g>
  );
}

function Ball({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="#fff" />
      <path d={`M${cx - r} ${cy}Q${cx} ${cy - r * 0.9} ${cx + r} ${cy}`} fill="none" stroke="#2563eb" strokeWidth={r * 0.28} />
      <path d={`M${cx - r * 0.7} ${cy + r * 0.7}Q${cx} ${cy - r * 0.2} ${cx + r * 0.7} ${cy + r * 0.7}`} fill="none" stroke="#facc15" strokeWidth={r * 0.28} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgb(0 0 0 / .18)" strokeWidth={1} />
    </g>
  );
}

function Heart({ x, y, s, fill, opacity = 1 }: { x: number; y: number; s: number; fill: string; opacity?: number }) {
  return <path transform={`translate(${x} ${y}) scale(${s})`} d="M0 5C-9-1.5-6.5-8.6-2.6-8.6c1.2 0 2.1.6 2.6 1.6.5-1 1.4-1.6 2.6-1.6C6.5-8.6 9-1.5 0 5Z" fill={fill} opacity={opacity} />;
}

/** Jogador(a) em silhueta, saltando pra cortada. */
function Spiker({ x, y, s = 1, fill }: { x: number; y: number; s?: number; fill: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} fill={fill}>
      <circle cx="0" cy="-30" r="6" />
      <path d="M-5-24 5-24 7-6 3-6 0 6 -3-6 -7-6Z" />
      <path d="M3-22 20-44 24-40 8-18Z" />
      <path d="M-4-22-14-8-10-5 0-17Z" />
      <path d="M-3-6-8 14-4 15 1-4Z M3-6 11 12 15 10 7-6Z" />
    </g>
  );
}

const ART: Record<BannerId, () => ReactNode> = {
  quadra: () => (
    <>
      <defs>
        <linearGradient id="pbq-w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#c98a45" /><stop offset="1" stopColor="#8a531f" /></linearGradient>
        <linearGradient id="pbq-b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#140b33" /><stop offset="1" stopColor="#3a1f7a" /></linearGradient>
        <radialGradient id="pbq-l" cx=".5" cy="0" r=".9"><stop offset="0" stopColor="#fff" stopOpacity=".35" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></radialGradient>
      </defs>
      <rect width="600" height="200" fill="url(#pbq-b)" />
      <polygon points="0,112 600,112 600,200 0,200" fill="url(#pbq-w)" />
      {Array.from({ length: 13 }, (_, i) => <line key={i} x1={300} y1={112} x2={-300 + i * 100} y2={200} stroke="#f7e3c0" strokeWidth={0.9} opacity={0.35} />)}
      <polygon points="120,200 220,112 380,112 480,200" fill="none" stroke="#fff" strokeWidth={2.5} opacity={0.85} />
      <line x1="300" y1="112" x2="300" y2="200" stroke="#fff" strokeWidth={2} opacity={0.6} />
      <Net x={150} y={80} w={300} h={32} />
      <rect x="148" y="78" width="4" height="40" fill="#e5e7eb" /><rect x="448" y="78" width="4" height="40" fill="#e5e7eb" />
      <rect width="600" height="130" fill="url(#pbq-l)" />
      <Ball cx={500} cy={52} r={16} />
      <ellipse cx="500" cy="186" rx="22" ry="4" fill="#000" opacity=".25" />
    </>
  ),
  praia: () => (
    <>
      <defs>
        <linearGradient id="pbp-s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#38bdf8" /><stop offset="1" stopColor="#fde68a" /></linearGradient>
        <linearGradient id="pbp-m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0ea5e9" /><stop offset="1" stopColor="#0369a1" /></linearGradient>
        <linearGradient id="pbp-a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fde68a" /><stop offset="1" stopColor="#f59e0b" /></linearGradient>
        <radialGradient id="pbp-sun"><stop offset="0" stopColor="#fff" /><stop offset=".4" stopColor="#fff7c2" /><stop offset="1" stopColor="#fde68a" stopOpacity="0" /></radialGradient>
      </defs>
      <rect width="600" height="200" fill="url(#pbp-s)" />
      <circle cx="470" cy="62" r="64" fill="url(#pbp-sun)" />
      <circle cx="470" cy="62" r="22" fill="#fffbe0" />
      <rect y="104" width="600" height="38" fill="url(#pbp-m)" />
      <path d="M0 118Q30 110 60 118T120 118T180 118T240 118T300 118T360 118T420 118T480 118T540 118T600 118" fill="none" stroke="#fff" strokeWidth={2} opacity=".55" />
      <path d="M0 132Q30 126 60 132T120 132T180 132T240 132T300 132T360 132T420 132T480 132T540 132T600 132" fill="none" stroke="#fff" strokeWidth={1.5} opacity=".35" />
      <path d="M0 142Q150 128 300 140T600 134V200H0Z" fill="url(#pbp-a)" />
      <Net x={110} y={116} w={150} h={34} color="#fff" opacity={0.85} />
      <rect x="108" y="112" width="4" height="62" fill="#f1f5f9" /><rect x="258" y="112" width="4" height="62" fill="#f1f5f9" />
      <path d="M560 200Q556 150 566 118" stroke="#78350f" strokeWidth="5" fill="none" />
      <path d="M566 118Q540 100 520 110M566 118Q552 92 536 90M566 118Q584 96 604 100M566 118Q590 118 606 130" stroke="#15803d" strokeWidth="6" strokeLinecap="round" fill="none" />
      <Ball cx={330} cy={164} r={14} />
    </>
  ),
  "por-do-sol": () => (
    <>
      <defs>
        <linearGradient id="pbs-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2e1065" /><stop offset=".45" stopColor="#be185d" /><stop offset=".75" stopColor="#fb923c" /><stop offset="1" stopColor="#fde047" /></linearGradient>
        <linearGradient id="pbs-r" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fb923c" /><stop offset="1" stopColor="#7c2d12" /></linearGradient>
      </defs>
      <rect width="600" height="200" fill="url(#pbs-g)" />
      <Stars n={26} yMax={70} seed={7} />
      <circle cx="300" cy="140" r="58" fill="#fef08a" />
      <circle cx="300" cy="140" r="86" fill="#fde047" opacity=".25" />
      <rect y="140" width="600" height="60" fill="url(#pbs-r)" />
      {[0, 1, 2, 3].map((i) => <rect key={i} x={250 - i * 6} y={146 + i * 9} width={100 + i * 12} height={2.5} rx={1.2} fill="#fde68a" opacity={0.7 - i * 0.12} />)}
      <Net x={380} y={118} w={120} h={26} color="#1f0a3d" opacity={0.85} />
      <rect x="378" y="112" width="4" height="62" fill="#1f0a3d" /><rect x="498" y="112" width="4" height="62" fill="#1f0a3d" />
      <Spiker x={330} y={128} s={1.5} fill="#1f0a3d" />
      <Spiker x={110} y={170} s={1.1} fill="#1f0a3d" />
    </>
  ),
  vpa: () => (
    <>
      <defs>
        <linearGradient id="pbv-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#6d28d9" /><stop offset=".55" stopColor="#3b1a80" /><stop offset="1" stopColor="#150b32" /></linearGradient>
        <radialGradient id="pbv-r" cx=".85" cy=".1" r=".7"><stop offset="0" stopColor="#f0abfc" stopOpacity=".5" /><stop offset="1" stopColor="#f0abfc" stopOpacity="0" /></radialGradient>
      </defs>
      <rect width="600" height="200" fill="url(#pbv-g)" />
      <rect width="600" height="200" fill="url(#pbv-r)" />
      <g opacity=".14" fill="none" stroke="#fff" strokeWidth={5}>
        <circle cx="470" cy="110" r="150" />
        <path d="M330 60Q470 10 610 70M345 170Q470 110 600 190M470-40Q420 110 500 260" />
      </g>
      {Array.from({ length: 22 }, (_, i) => <Heart key={i} x={Math.round(rand(i + 3) * 600)} y={Math.round(rand(i + 40) * 200)} s={+(0.9 + rand(i + 80) * 2.6).toFixed(2)} fill={i % 3 === 0 ? "#f0abfc" : i % 3 === 1 ? "#c4b5fd" : "#fff"} opacity={+(0.2 + rand(i + 120) * 0.5).toFixed(2)} />)}
      <Heart x={78} y={104} s={7} fill="#fff" opacity={0.92} />
      <Heart x={78} y={104} s={7} fill="none" />
    </>
  ),
  neon: () => (
    <>
      <defs>
        <linearGradient id="pbn-s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fde047" /><stop offset=".5" stopColor="#fb7185" /><stop offset="1" stopColor="#c026d3" /></linearGradient>
        <linearGradient id="pbn-b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0b0620" /><stop offset="1" stopColor="#2a0a52" /></linearGradient>
        <clipPath id="pbn-c"><rect y="30" width="600" height="82" /></clipPath>
      </defs>
      <rect width="600" height="200" fill="url(#pbn-b)" />
      <Stars n={30} yMax={90} seed={21} color="#a5f3fc" />
      <circle cx="300" cy="86" r="64" fill="url(#pbn-s)" clipPath="url(#pbn-c)" />
      {[58, 70, 80, 88, 95].map((y, i) => <rect key={y} x="230" y={y} width="140" height={1.5 + i * 0.9} fill="#0b0620" />)}
      <rect y="112" width="600" height="88" fill="#12062e" />
      <g stroke="#22d3ee" strokeWidth={1.4} opacity=".85">
        {Array.from({ length: 17 }, (_, i) => <line key={i} x1="300" y1="112" x2={-500 + i * 100} y2="200" />)}
        {[120, 130, 144, 162, 186].map((y) => <line key={y} x1="0" y1={y} x2="600" y2={y} />)}
      </g>
      <line x1="0" y1="112" x2="600" y2="112" stroke="#f0abfc" strokeWidth={2.5} />
      <circle cx="96" cy="64" r="18" fill="none" stroke="#f0abfc" strokeWidth={3} />
      <path d="M78 64Q96 50 114 64M84 78Q96 62 108 78" fill="none" stroke="#22d3ee" strokeWidth={2.5} />
    </>
  ),
  noite: () => (
    <>
      <defs>
        <linearGradient id="pbno-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#020617" /><stop offset=".7" stopColor="#1e1b4b" /><stop offset="1" stopColor="#4c1d95" /></linearGradient>
      </defs>
      <rect width="600" height="200" fill="url(#pbno-g)" />
      <Stars n={70} yMax={140} seed={11} />
      <circle cx="480" cy="56" r="26" fill="#fef9c3" />
      <circle cx="492" cy="50" r="24" fill="#1a1550" />
      <path d="M0 150Q90 120 190 146T380 140T600 150V200H0Z" fill="#0f0a2e" />
      <path d="M0 172Q160 150 330 170T600 166V200H0Z" fill="#080520" />
      <Net x={150} y={128} w={110} h={24} color="#c4b5fd" opacity={0.7} />
      <rect x="148" y="122" width="4" height="54" fill="#c4b5fd" opacity=".8" /><rect x="258" y="122" width="4" height="54" fill="#c4b5fd" opacity=".8" />
      <Ball cx={330} cy={158} r={10} />
    </>
  ),
  tropical: () => (
    <>
      <defs>
        <linearGradient id="pbt-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#99f6e4" /><stop offset="1" stopColor="#fef08a" /></linearGradient>
      </defs>
      <rect width="600" height="200" fill="url(#pbt-g)" />
      {Array.from({ length: 9 }, (_, i) => <polygon key={i} points={`300,-10 ${100 + i * 50},210 ${130 + i * 50},210`} fill="#fff" opacity=".1" />)}
      <circle cx="300" cy="40" r="30" fill="#fff" opacity=".8" />
      <g fill="#047857">
        <path d="M-10 200Q10 90 120 40Q90 100 130 130Q80 120 70 200Z" />
        <path d="M-10 200Q-4 120 60 70Q50 120 40 200Z" fill="#065f46" />
        <path d="M610 200Q590 80 470 30Q500 100 464 130Q520 120 530 200Z" />
        <path d="M610 200Q604 120 540 60Q552 120 560 200Z" fill="#065f46" />
      </g>
      <path d="M0 176Q150 160 300 174T600 168V200H0Z" fill="#fcd34d" />
      <Net x={200} y={134} w={200} h={36} color="#064e3b" opacity={0.65} />
      <rect x="198" y="128" width="5" height="62" fill="#78350f" /><rect x="397" y="128" width="5" height="62" fill="#78350f" />
      <Ball cx={300} cy={106} r={12} />
      <circle cx="140" cy="88" r="6" fill="#fb7185" /><circle cx="148" cy="96" r="5" fill="#f43f5e" /><circle cx="470" cy="84" r="6" fill="#fb7185" />
    </>
  ),
  trovoada: () => (
    <>
      <defs>
        <linearGradient id="pbtr-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0f172a" /><stop offset="1" stopColor="#334155" /></linearGradient>
        <radialGradient id="pbtr-f" cx=".55" cy=".35" r=".4"><stop offset="0" stopColor="#fef9c3" stopOpacity=".55" /><stop offset="1" stopColor="#fef9c3" stopOpacity="0" /></radialGradient>
      </defs>
      <rect width="600" height="200" fill="url(#pbtr-g)" />
      <rect width="600" height="200" fill="url(#pbtr-f)" />
      <g fill="#1e293b">
        <ellipse cx="90" cy="30" rx="130" ry="44" /><ellipse cx="270" cy="14" rx="150" ry="40" /><ellipse cx="470" cy="28" rx="160" ry="46" /><ellipse cx="600" cy="10" rx="90" ry="40" />
      </g>
      <g fill="#475569" opacity=".6"><ellipse cx="180" cy="46" rx="100" ry="22" /><ellipse cx="400" cy="50" rx="120" ry="22" /></g>
      <polygon points="330,28 296,98 322,98 292,176 360,86 332,86 358,28" fill="#fde047" />
      <polygon points="330,28 296,98 322,98 292,176 360,86 332,86 358,28" fill="none" stroke="#fff" strokeWidth={2} opacity=".8" />
      <g stroke="#94a3b8" strokeWidth={1} opacity=".35">
        {Array.from({ length: 34 }, (_, i) => <line key={i} x1={Math.round(rand(i + 5) * 600)} y1={Math.round(60 + rand(i + 50) * 120)} x2={Math.round(rand(i + 5) * 600) - 8} y2={Math.round(60 + rand(i + 50) * 120) + 18} />)}
      </g>
      <path d="M0 186H600V200H0Z" fill="#0f172a" />
    </>
  ),
  fornalha: () => (
    <>
      <defs>
        <linearGradient id="pbf-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1c0a05" /><stop offset=".55" stopColor="#7f1d1d" /><stop offset="1" stopColor="#ea580c" /></linearGradient>
        <linearGradient id="pbf-f" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#fde047" /><stop offset=".5" stopColor="#f97316" /><stop offset="1" stopColor="#dc2626" /></linearGradient>
      </defs>
      <rect width="600" height="200" fill="url(#pbf-g)" />
      {[30, 90, 150, 210, 270, 330, 390, 450, 510, 570].map((x, i) => (
        <path key={x} d={`M${x - 36} 200Q${x - 28} ${150 - (i % 3) * 14} ${x - 6} ${118 - (i % 4) * 14}Q${x} ${150} ${x + 10} ${128 - (i % 2) * 18}Q${x + 34} ${150} ${x + 38} 200Z`} fill="url(#pbf-f)" opacity={0.92} />
      ))}
      {Array.from({ length: 28 }, (_, i) => <circle key={i} cx={Math.round(rand(i + 9) * 600)} cy={Math.round(rand(i + 60) * 150)} r={+(0.8 + rand(i + 90) * 1.8).toFixed(2)} fill="#fde047" opacity={+(0.4 + rand(i + 120) * 0.6).toFixed(2)} />)}
      <Ball cx={300} cy={88} r={20} />
    </>
  ),
  arena: () => (
    <>
      <defs>
        <linearGradient id="pba-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#05030f" /><stop offset="1" stopColor="#1b1040" /></linearGradient>
        <linearGradient id="pba-c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff" stopOpacity=".55" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient>
      </defs>
      <rect width="600" height="200" fill="url(#pba-g)" />
      {[90, 230, 370, 510].map((x, i) => <polygon key={x} points={`${x - 8},14 ${x + 8},14 ${x + 70 - i * 6},160 ${x - 70 - i * 6},160`} fill="url(#pba-c)" />)}
      {[90, 230, 370, 510].map((x) => <rect key={x} x={x - 22} y="6" width="44" height="12" rx="3" fill="#fef9c3" />)}
      <rect y="150" width="600" height="50" fill="#2b1768" />
      {Array.from({ length: 70 }, (_, i) => <circle key={i} cx={Math.round(i * 8.7 + rand(i) * 4)} cy={Math.round(138 + rand(i + 50) * 22)} r={+(3 + rand(i + 99) * 2).toFixed(1)} fill={["#7c3aed", "#a78bfa", "#f0abfc", "#38bdf8"][i % 4]} opacity={0.75} />)}
      <polygon points="140,200 230,168 370,168 460,200" fill="#c98a45" opacity=".9" />
      <line x1="300" y1="168" x2="300" y2="200" stroke="#fff" strokeWidth={2} opacity=".7" />
      <Net x={230} y={150} w={140} h={18} opacity={0.8} />
    </>
  ),
  podio: () => (
    <>
      <defs>
        <linearGradient id="pbpo-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3b0764" /><stop offset="1" stopColor="#1a0b3d" /></linearGradient>
        <linearGradient id="pbpo-y" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fde68a" /><stop offset="1" stopColor="#d97706" /></linearGradient>
        <radialGradient id="pbpo-s" cx=".5" cy="0" r=".8"><stop offset="0" stopColor="#fde68a" stopOpacity=".6" /><stop offset="1" stopColor="#fde68a" stopOpacity="0" /></radialGradient>
      </defs>
      <rect width="600" height="200" fill="url(#pbpo-g)" />
      <rect width="600" height="200" fill="url(#pbpo-s)" />
      <rect x="210" y="118" width="86" height="82" fill="#cbd5e1" /><rect x="304" y="96" width="86" height="104" fill="url(#pbpo-y)" /><rect x="398" y="138" width="86" height="62" fill="#c2410c" />
      <g fontFamily="system-ui,sans-serif" fontWeight={900} fontSize={34} textAnchor="middle" fill="#fff" opacity=".9"><text x="253" y="168">2</text><text x="347" y="156">1</text><text x="441" y="180">3</text></g>
      <g transform="translate(347 36)"><path d="M-18-4H18V10Q18 28 0 32Q-18 28-18 10Z" fill="url(#pbpo-y)" /><path d="M-18 0H-28Q-28 16-14 18M18 0H28Q28 16 14 18" fill="none" stroke="#fde68a" strokeWidth={3} /><rect x="-4" y="32" width="8" height="14" fill="#fde68a" /><rect x="-14" y="46" width="28" height="7" rx="2" fill="#d97706" /></g>
      {Array.from({ length: 34 }, (_, i) => <rect key={i} x={Math.round(rand(i + 2) * 600)} y={Math.round(rand(i + 70) * 120)} width={5} height={9} fill={["#f0abfc", "#fde047", "#38bdf8", "#fb7185"][i % 4]} opacity={0.85} transform={`rotate(${Math.round(rand(i + 140) * 180)} ${Math.round(rand(i + 2) * 600)} ${Math.round(rand(i + 70) * 120)})`} />)}
    </>
  ),
  galaxia: () => (
    <>
      <defs>
        <radialGradient id="pbg-g" cx=".7" cy=".5" r=".9"><stop offset="0" stopColor="#7e22ce" /><stop offset=".45" stopColor="#2e1065" /><stop offset="1" stopColor="#02010a" /></radialGradient>
        <radialGradient id="pbg-p" cx=".35" cy=".35"><stop offset="0" stopColor="#fda4af" /><stop offset="1" stopColor="#9d174d" /></radialGradient>
      </defs>
      <rect width="600" height="200" fill="url(#pbg-g)" />
      <g fill="none" stroke="#e9d5ff" strokeOpacity=".28" strokeWidth={14}><ellipse cx="420" cy="100" rx="260" ry="60" transform="rotate(-18 420 100)" /></g>
      <g fill="none" stroke="#f0abfc" strokeOpacity=".3" strokeWidth={4}><ellipse cx="420" cy="100" rx="200" ry="40" transform="rotate(-18 420 100)" /></g>
      <Stars n={90} yMax={200} seed={31} max={1.9} />
      <circle cx="110" cy="70" r="34" fill="url(#pbg-p)" />
      <ellipse cx="110" cy="76" rx="56" ry="9" fill="none" stroke="#fde68a" strokeWidth={4} transform="rotate(-14 110 76)" opacity=".9" />
      <Ball cx={470} cy={96} r={18} />
    </>
  ),
  lendario: () => (
    <>
      <defs>
        <linearGradient id="pbl-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#0a0a0a" /><stop offset="1" stopColor="#1c1917" /></linearGradient>
        <linearGradient id="pbl-y" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fef08a" /><stop offset=".5" stopColor="#f59e0b" /><stop offset="1" stopColor="#92400e" /></linearGradient>
      </defs>
      <rect width="600" height="200" fill="url(#pbl-g)" />
      {Array.from({ length: 16 }, (_, i) => <polygon key={i} points={`300,230 ${-300 + i * 80},-20 ${-260 + i * 80},-20`} fill="#f59e0b" opacity={i % 2 ? 0.08 : 0.15} />)}
      <g fill="none" stroke="url(#pbl-y)" strokeWidth={5} strokeLinecap="round">
        <path d="M250 170Q196 150 190 90M262 176Q205 160 196 110" />
        <path d="M350 170Q404 150 410 90M338 176Q395 160 404 110" />
      </g>
      <path d="M262 112L270 74L288 98L300 62L312 98L330 74L338 112Z" fill="url(#pbl-y)" />
      <rect x="262" y="112" width="76" height="12" rx="3" fill="url(#pbl-y)" />
      <circle cx="300" cy="60" r="4" fill="#fff7c2" /><circle cx="270" cy="72" r="3" fill="#fff7c2" /><circle cx="330" cy="72" r="3" fill="#fff7c2" />
      <Stars n={26} yMax={200} seed={51} color="#fde68a" />
    </>
  ),
};

export function ProfileBannerArt({ id, className = "" }: { id: BannerId; className?: string }) {
  const draw = ART[id];
  if (!draw) return null;
  return (
    <svg className={`block h-full w-full ${className}`} viewBox="0 0 600 200" preserveAspectRatio="xMidYMid slice" aria-hidden focusable="false">
      {draw()}
    </svg>
  );
}
