import type { ReactNode } from "react";
import type { AvatarFrameId } from "@/lib/avatarFrames";

/**
 * Desenho das molduras. Tudo em SVG, no mesmo sistema de coordenadas:
 *   - a foto é o círculo de centro (60,60) e raio 40 (o recorte abaixo garante
 *     que nenhuma moldura cubra a foto);
 *   - há 46 unidades livres em cima (orelhas, coroa...) e ~8 nas laterais/embaixo.
 * O <svg> é posicionado pelo Avatar (170% do tamanho da foto, deslocado).
 */

const C = 60;
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Ponto na circunferência: 0° = topo, sentido horário. */
function polar(radius: number, deg: number): [number, number] {
  const rad = (deg * Math.PI) / 180;
  return [r2(C + radius * Math.sin(rad)), r2(C - radius * Math.cos(rad))];
}

function arcPath(radius: number, fromDeg: number, toDeg: number) {
  const [x1, y1] = polar(radius, fromDeg);
  const [x2, y2] = polar(radius, toDeg);
  const large = Math.abs(toDeg - fromDeg) > 180 ? 1 : 0;
  return `M${x1} ${y1}A${radius} ${radius} 0 ${large} 1 ${x2} ${y2}`;
}

function Ring({ r = 43, w = 5, stroke, dash, opacity }: { r?: number; w?: number; stroke: string; dash?: string; opacity?: number }) {
  return <circle cx={C} cy={C} r={r} fill="none" stroke={stroke} strokeWidth={w} strokeDasharray={dash} opacity={opacity} />;
}

function Heart({ x, y, s = 1, fill, stroke, className, style }: { x: number; y: number; s?: number; fill: string; stroke?: string; className?: string; style?: React.CSSProperties }) {
  return (
    <path
      className={className}
      style={style}
      transform={`translate(${x} ${y}) scale(${s})`}
      d="M0 5C-9-1.5-6.5-8.6-2.6-8.6c1.2 0 2.1.6 2.6 1.6.5-1 1.4-1.6 2.6-1.6C6.5-8.6 9-1.5 0 5Z"
      fill={fill}
      stroke={stroke}
      strokeWidth={stroke ? 0.7 : 0}
      strokeLinejoin="round"
    />
  );
}

function Sparkle({ x, y, s = 1, fill, delay = 0 }: { x: number; y: number; s?: number; fill: string; delay?: number }) {
  return (
    <path
      className="afr-twinkle"
      style={{ "--d": `${delay}s` } as React.CSSProperties}
      transform={`translate(${x} ${y}) scale(${s})`}
      d="M0-7C.7-2.6 2.6-.7 7 0 2.6.7.7 2.6 0 7-.7 2.6-2.6.7-7 0-2.6-.7-.7-2.6 0-7Z"
      fill={fill}
    />
  );
}

function Ball({ x, y, r }: { x: number; y: number; r: number }) {
  const k = r / 10;
  return (
    <g transform={`translate(${x} ${y}) scale(${k})`}>
      <circle r="10" fill="#fff" stroke="#263266" strokeWidth="1.1" />
      <path d="M-9.4-3.4C-3.6-7.6 4-7.6 9.4-3.4" fill="none" stroke="#2f6fe0" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M-5.2 8.4C-7.4 2.4-5.4-3.6 0-8.4" fill="none" stroke="#ffc928" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M5.2 8.4C7.4 2.4 5.4-3.6 0-8.4" fill="none" stroke="#2f6fe0" strokeWidth="2.4" strokeLinecap="round" />
      <circle r="10" fill="none" stroke="#263266" strokeWidth="1.1" />
    </g>
  );
}

function Daisy({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {Array.from({ length: 8 }, (_, i) => (
        <ellipse key={i} cx="0" cy="-5.2" rx="2.5" ry="4.8" fill="#fff" stroke="#d9d3e8" strokeWidth=".5" transform={`rotate(${i * 45})`} />
      ))}
      <circle r="3" fill="#ffc928" stroke="#e59c0b" strokeWidth=".6" />
    </g>
  );
}

function Blossom({ x, y, s = 1, rot = 0 }: { x: number; y: number; s?: number; rot?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}>
      {Array.from({ length: 5 }, (_, i) => (
        <path
          key={i}
          transform={`rotate(${i * 72})`}
          d="M0 0C-3.6-2.2-4.2-7.2-1.6-9L0-7.4 1.6-9C4.2-7.2 3.6-2.2 0 0Z"
          fill="#ffd3e2"
          stroke="#ef8fb1"
          strokeWidth=".6"
          strokeLinejoin="round"
        />
      ))}
      <circle r="1.5" fill="#ffe08a" />
    </g>
  );
}

function Bolt({ x, y, rot, s = 1 }: { x: number; y: number; rot: number; s?: number }) {
  return (
    <path
      className="afr-flicker"
      transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}
      d="M-2.6 0-7-11-2-10-5.6-22 6-7.4 1-8.4 3.4 0Z"
      fill="#fff2a0"
      stroke="#f59e0b"
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
  );
}

/** Círculo invisível: dá ao grupo que gira o mesmo centro da foto. */
function Anchor() {
  return <circle cx={C} cy={C} r="52" fill="none" />;
}

/** Línguas de fogo ao redor da foto; o degradê vai do miolo claro à ponta colorida. */
function Flames({ id, inner, mid, outer, from, to, count, minH, maxH }: { id: string; inner: string; mid: string; outer: string; from: number; to: number; count: number; minH: number; maxH: number }) {
  return (
    <>
      <defs>
        <radialGradient id={id} cx="60" cy="60" r="66" gradientUnits="userSpaceOnUse">
          <stop offset=".6" stopColor={inner} />
          <stop offset=".8" stopColor={mid} />
          <stop offset="1" stopColor={outer} />
        </radialGradient>
      </defs>
      <g className="afr-breathe" style={{ animationDuration: "1.8s" }}>
        <Anchor />
        {Array.from({ length: count }, (_, i) => {
          const a = from + ((to - from) * i) / (count - 1);
          const h = minH + (((i * 7) % 5) / 4) * (maxH - minH);
          const lean = i % 2 ? 7 : -7;
          const [bx1, by1] = polar(40, a - 7);
          const [bx2, by2] = polar(40, a + 7);
          const [cx1, cy1] = polar(40 + h * 0.4, a - 8 + lean * 0.3);
          const [cx2, cy2] = polar(40 + h * 0.75, a + 5 + lean * 0.5);
          const [tx, ty] = polar(40 + h, a + lean);
          return (
            <g key={i} className="afr-flame" style={{ "--d": `${(i % 4) * 0.22}s` } as React.CSSProperties}>
              <path d={`M${bx1} ${by1}Q${cx1} ${cy1} ${tx} ${ty}Q${cx2} ${cy2} ${bx2} ${by2}Z`} fill={`url(#${id})`} stroke={mid} strokeWidth=".6" strokeLinejoin="round" />
            </g>
          );
        })}
      </g>
    </>
  );
}

function Snowflake({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} stroke="#e0f7ff" strokeWidth="1.1" strokeLinecap="round">
      {[0, 60, 120].map((deg) => (
        <g key={deg} transform={`rotate(${deg})`}>
          <line x1="0" y1="-5" x2="0" y2="5" />
          <path d="M-1.8-3.4 0-1.6 1.8-3.4M-1.8 3.4 0 1.6 1.8 3.4" fill="none" strokeWidth=".8" />
        </g>
      ))}
    </g>
  );
}

const BAT = "M0 0C-3-3-7-3-10 0-8-1-6 0-5 2-3 0-2 1 0 3 2 1 3 0 5 2 6 0 8-1 10 0 7-3 3-3 0 0Z";

const FRAMES: Record<AvatarFrameId, () => ReactNode> = {
  coelhinho: () => (
    <>
      <g className="afr-ear"><g transform="rotate(-12 46 22)">
        <ellipse cx="46" cy="0" rx="9" ry="22" fill="#fffafc" stroke="#f4a9c6" strokeWidth="1.6" />
        <ellipse cx="46" cy="3" rx="4.5" ry="16" fill="#ffc4da" />
      </g></g>
      <g className="afr-ear" style={{ "--d": ".5s" } as React.CSSProperties}><g transform="rotate(12 74 22)">
        <ellipse cx="74" cy="0" rx="9" ry="22" fill="#fffafc" stroke="#f4a9c6" strokeWidth="1.6" />
        <ellipse cx="74" cy="3" rx="4.5" ry="16" fill="#ffc4da" />
        {/* pontinha dobrada: a orelha que cai um pouquinho */}
        <path d="M68-17Q74-26 80-17Q74-20 68-17Z" fill="#f4a9c6" opacity=".55" />
      </g></g>
      <Ring stroke="#fffafc" />
      <Ring r={46} w={1.3} stroke="#f4a9c6" />
      <Ring r={40.6} w={1} stroke="#ffc4da" />
      <Heart x={14} y={92} s={.8} fill="#ffb3cf" className="afr-float" style={{ "--d": ".2s" } as React.CSSProperties} />
      <Heart x={104} y={70} s={.6} fill="#ffc4da" className="afr-float" style={{ "--d": "1.1s" } as React.CSSProperties} />
      {/* lacinho */}
      <g className="afr-sway"><g transform="translate(98 96) rotate(22)">
        <path d="M0 0-9-6V6ZM0 0 9-6V6Z" fill="#ff7fae" stroke="#e0527f" strokeWidth=".9" strokeLinejoin="round" />
        <circle r="2.6" fill="#ff9cc0" stroke="#e0527f" strokeWidth=".9" />
      </g></g>
    </>
  ),

  gatinho: () => (
    <>
      <g className="afr-ear">
        <path d="M24 36 26 3 52 18.5Z" fill="#f2a04a" stroke="#b85f17" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M29.5 30 30.4 11 44.5 19.5Z" fill="#ffd2ab" />
      </g>
      <g className="afr-ear" style={{ "--d": "1.2s" } as React.CSSProperties}>
        <path d="M96 36 94 3 68 18.5Z" fill="#f2a04a" stroke="#b85f17" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M90.5 30 89.6 11 75.5 19.5Z" fill="#ffd2ab" />
      </g>
      <Ring stroke="#f2a04a" />
      <Ring stroke="#b85f17" w={5} dash="2.4 13.2" />
      <Ring r={46} w={1} stroke="#b85f17" />
      <Ring r={40.5} w={1} stroke="#b85f17" />
      {[[56, 50], [61, 61], [66, 72]].map(([y1, y2]) => (
        <g key={y1} className="afr-sway" style={{ "--d": `${y2 / 60}s` } as React.CSSProperties} stroke="#fff" strokeWidth="1.5" strokeLinecap="round" opacity=".92">
          <line x1="13" y1={y1} x2="-5" y2={y2} />
          <line x1="107" y1={y1} x2="125" y2={y2} />
        </g>
      ))}
      {/* patinha */}
      <g className="afr-float"><g transform="translate(90 99)">
        <circle r="8.2" fill="#fff6ee" stroke="#b85f17" strokeWidth="1.1" />
        <ellipse cx="0" cy="1.6" rx="3.2" ry="2.6" fill="#ff9fb8" />
        {[[-3.8, -2.6], [-1.3, -4.4], [1.3, -4.4], [3.8, -2.6]].map(([dx, dy], i) => (
          <circle key={i} cx={dx} cy={dy} r="1.35" fill="#ff9fb8" />
        ))}
      </g></g>
    </>
  ),

  ursinho: () => (
    <>
      <g className="afr-breathe">
        <circle cx="25" cy="24" r="11.5" fill="#a8683a" stroke="#6f3f1d" strokeWidth="1.6" />
        <circle cx="25" cy="24" r="5.8" fill="#e8b98e" />
      </g>
      <g className="afr-breathe" style={{ animationDelay: ".4s" }}>
        <circle cx="95" cy="24" r="11.5" fill="#a8683a" stroke="#6f3f1d" strokeWidth="1.6" />
        <circle cx="95" cy="24" r="5.8" fill="#e8b98e" />
      </g>
      <Ring stroke="#bf7e49" />
      <Ring r={43} w={1.4} stroke="#e6b183" dash="1 5" />
      <Ring r={46.2} w={1.2} stroke="#6f3f1d" />
      <Ring r={40.4} w={1} stroke="#6f3f1d" />
      {/* gravatinha-borboleta */}
      <g className="afr-sway">
        <path d="M60 104 50 98.5V109.5ZM60 104 70 98.5V109.5Z" fill="#e5484d" stroke="#a3262b" strokeWidth="1" strokeLinejoin="round" />
        <circle cx="60" cy="104" r="2.6" fill="#ff7378" stroke="#a3262b" strokeWidth="1" />
      </g>
      {([[100, 14, 6, 0], [108, 4, 4.6, .9], [114, -4, 3.4, 1.8]] as const).map(([x, y, fs, d]) => (
        <text key={x} className="afr-float" style={{ "--d": `${d}s` } as React.CSSProperties} x={x} y={y} fontSize={fs} fontWeight="900" fill="#fff" stroke="#6f3f1d" strokeWidth=".5" fontFamily="system-ui, sans-serif">z</text>
      ))}
    </>
  ),

  margaridas: () => (
    <>
      <Ring r={43.5} w={3.4} stroke="#6fb85c" />
      <Ring r={45.3} w={1} stroke="#4c9a3d" />
      <g className="afr-orbit" style={{ animationDuration: "34s" }}>
        <circle cx={C} cy={C} r="50" fill="none" />
        {[22, 67, 112, 157, 202, 247, 292, 337].map((deg) => {
          const [x, y] = polar(44, deg);
          return <ellipse key={deg} cx={x} cy={y} rx="3.4" ry="1.8" fill="#7fc96b" stroke="#4c9a3d" strokeWidth=".6" transform={`rotate(${deg + 90} ${x} ${y})`} />;
        })}
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => {
          const [x, y] = polar(44.5, deg);
          return <Daisy key={deg} x={x} y={y} s={i % 2 ? 0.72 : 0.95} />;
        })}
      </g>
      <Sparkle x={104} y={12} s={.7} fill="#fff7a8" delay={.3} />
      <Sparkle x={14} y={100} s={.6} fill="#fff7a8" delay={1} />
    </>
  ),

  sakura: () => (
    <>
      <Ring r={43.2} w={3.6} stroke="#ffcadb" />
      <Ring r={45.4} w={1} stroke="#ef8fb1" />
      <Ring r={40.8} w={.8} stroke="#ef8fb1" opacity={.8} />
      {([[-50, 47, 1.45, 10], [40, 48, 1.1, -20], [148, 47, 1.3, 35], [-128, 46, 0.95, 0]] as const).map(([deg, rad, s, rot]) => {
        const [x, y] = polar(rad, deg);
        return <Blossom key={deg} x={x} y={y} s={s} rot={rot} />;
      })}
      {([[8, 102, 40], [-3, 80, -30], [114, 36, 20], [108, 100, -50], [20, 98, 80]] as const).map(([px, py, rot], i) => (
        <ellipse key={i} className="afr-float" style={{ "--d": `${i * 0.5}s` } as React.CSSProperties} cx={px} cy={py} rx="2.3" ry="3.6" fill="#ffd3e2" stroke="#ef8fb1" strokeWidth=".5" transform={`rotate(${rot} ${px} ${py})`} />
      ))}
    </>
  ),

  magica: () => (
    <>
      <defs>
        <linearGradient id="afr-magic" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff8ad8" />
          <stop offset=".5" stopColor="#b388ff" />
          <stop offset="1" stopColor="#6fd3ff" />
        </linearGradient>
      </defs>
      <Ring r={43} w={4.4} stroke="url(#afr-magic)" />
      <Ring r={45.8} w={.8} stroke="#fff" opacity={.8} />
      {Array.from({ length: 12 }, (_, i) => {
        const [x, y] = polar(43, i * 30 + 15);
        return <circle key={i} cx={x} cy={y} r="1.15" fill="#fff" />;
      })}
      {([[-38, 54, 1.5, "#fff3a6", 0], [34, 52, 1.05, "#ffb3e6", .4], [96, 50, .85, "#9fe3ff", .9], [-102, 51, .8, "#d6b8ff", .2], [-160, 49, .95, "#fff3a6", .7]] as const).map(([deg, rad, s, fill, d]) => {
        const [x, y] = polar(rad, deg);
        return <Sparkle key={deg} x={x} y={y} s={s} fill={fill} delay={d} />;
      })}
      <Heart x={60} y={104} s={.9} fill="#ff8ac8" stroke="#fff" />
    </>
  ),

  aura: () => {
    const points: string[] = [];
    const spikes = 20;
    for (let i = 0; i < spikes * 2; i++) {
      const outer = i % 2 === 0;
      const rad = outer ? (i % 4 === 0 ? 59 : 53) : 45;
      const deg = (i * 180) / spikes;
      const [x, y] = polar(rad, deg);
      points.push(`${x},${y}`);
    }
    return (
      <>
        <defs>
          <radialGradient id="afr-aura" cx="60" cy="60" r="60" gradientUnits="userSpaceOnUse">
            <stop offset=".7" stopColor="#fff4b0" stopOpacity=".95" />
            <stop offset="1" stopColor="#ff8a1f" stopOpacity=".9" />
          </radialGradient>
        </defs>
        <g className="afr-pulse">
          <polygon points={points.join(" ")} fill="url(#afr-aura)" stroke="#ff9d2e" strokeWidth=".8" strokeLinejoin="round" />
        </g>
        <Ring r={43} w={3.6} stroke="#fff8d6" />
        <Ring r={45.4} w={1.1} stroke="#ffb02e" />
      </>
    );
  },

  trovao: () => (
    <>
      <Ring r={43} w={4.6} stroke="#ffd426" />
      <g className="afr-spin-slow"><circle cx={C} cy={C} r="48" fill="none" /><Ring r={43} w={1.4} stroke="#fff6bf" dash="6 4" /></g>
      <Ring r={46} w={1} stroke="#d99700" />
      <Ring r={40.5} w={1} stroke="#d99700" />
      {([[-38, 45, -38, 1], [42, 45, 42, 1.05], [150, 45, 150, .95]] as const).map(([deg, rad, rot, s]) => {
        const [x, y] = polar(rad, deg);
        return <g key={deg} className="afr-flicker" style={{ "--d": `${(deg % 7) / 10}s` } as React.CSSProperties}><Bolt x={x} y={y} rot={rot} s={s} /></g>;
      })}
      {([[-85, 50], [95, 50], [-165, 48]] as const).map(([deg, rad]) => {
        const [x, y] = polar(rad, deg);
        return <circle key={deg} className="afr-twinkle" style={{ "--d": `${(deg % 5) / 3}s` } as React.CSSProperties} cx={x} cy={y} r="1.5" fill="#fff2a0" />;
      })}
    </>
  ),

  coroa: () => (
    <>
      <defs>
        <linearGradient id="afr-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff2b0" />
          <stop offset=".5" stopColor="#f5c542" />
          <stop offset="1" stopColor="#c98a12" />
        </linearGradient>
      </defs>
      <Ring stroke="url(#afr-gold)" />
      <Ring r={46} w={1} stroke="#a86a08" />
      <Ring r={40.5} w={1} stroke="#a86a08" />
      <path d="M42 21 38-2 49.5 8.5 60-9 70.5 8.5 82-2 78 21Z" fill="url(#afr-gold)" stroke="#a86a08" strokeWidth="1.4" strokeLinejoin="round" />
      <rect x="42" y="14.5" width="36" height="6.5" rx="1.6" fill="#e0a526" stroke="#a86a08" strokeWidth="1.1" />
      <circle cx="50" cy="17.7" r="1.7" fill="#4f9dff" />
      <circle cx="60" cy="17.7" r="2.1" fill="#e5334b" />
      <circle cx="70" cy="17.7" r="1.7" fill="#4f9dff" />
      {[[38, -3], [60, -10], [82, -3]].map(([x, y]) => (
        <circle key={x} cx={x} cy={y} r="2.4" fill="#fff6c0" stroke="#c98a12" strokeWidth="1" />
      ))}
      <Sparkle x={26} y={8} s={.9} fill="#fff3a6" delay={.2} />
      <Sparkle x={96} y={12} s={.7} fill="#fff3a6" delay={.8} />
    </>
  ),

  cortada: () => (
    <>
      <defs>
        <linearGradient id="afr-hit" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffb340" />
          <stop offset="1" stopColor="#ff4d3d" />
        </linearGradient>
      </defs>
      <Ring r={43} w={3.6} stroke="url(#afr-hit)" />
      <Ring r={45.6} w={.9} stroke="#ff4d3d" opacity={.7} />
      <g className="afr-spin">
        <circle cx={C} cy={C} r="48" fill="none" />
        {[[-78, -62, .1], [-62, -46, .2], [-46, -31, .34], [-31, -17, .55], [-17, -6, .8]].map(([a, b, o]) => (
          <path key={a} d={arcPath(48, a, b)} fill="none" stroke="#fff" strokeOpacity={o} strokeWidth="4.2" strokeLinecap="round" />
        ))}
        <Ball x={60} y={11} r={7} />
      </g>
    </>
  ),

  bola: () => (
    <>
      <g className="afr-spin-slow" style={{ animationDuration: "14s" }}>
        <circle cx={C} cy={C} r="50" fill="none" />
        {["#1f5fd1", "#ffffff", "#ffd23f", "#1f5fd1", "#ffffff", "#ffd23f"].map((fill, i) => (
          <path key={i} d={arcPath(43, i * 60 + 1.5, i * 60 + 58.5)} fill="none" stroke={fill} strokeWidth="7.2" />
        ))}
      </g>
      <Ring r={46.7} w={1} stroke="#1b2a5c" />
      <Ring r={39.5} w={1} stroke="#1b2a5c" />
      {Array.from({ length: 6 }, (_, i) => {
        const [x1, y1] = polar(39.5, i * 60);
        const [x2, y2] = polar(46.7, i * 60);
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#1b2a5c" strokeWidth="1.3" />;
      })}
    </>
  ),

  rede: () => (
    <>
      <defs>
        <pattern id="afr-net" width="4.6" height="4.6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="4.6" height="4.6" fill="#18204a" />
          <path d="M0 0H4.6M0 0V4.6" stroke="#e8ecff" strokeWidth=".8" />
        </pattern>
      </defs>
      <Ring r={43.2} w={7.4} stroke="url(#afr-net)" />
      <Ring r={47} w={1.7} stroke="#fff" />
      <Ring r={39.5} w={1.7} stroke="#fff" />
      <circle cx="96" cy="97" r="9" fill="#0d1233" opacity=".3" />
      <Ball x={95} y={95} r={8.5} />
    </>
  ),

  verao: () => {
    const grains = Array.from({ length: 26 }, (_, i) => polar(43 + ((i * 7) % 5) - 2, i * 13.8));
    return (
      <>
        <defs>
          <linearGradient id="afr-sand" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fdeebb" />
            <stop offset="1" stopColor="#e8b56a" />
          </linearGradient>
        </defs>
        <Ring stroke="url(#afr-sand)" />
        <Ring r={46} w={1} stroke="#c98f4a" />
        <Ring r={40.5} w={1} stroke="#c98f4a" />
        {grains.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r=".7" fill="#b9783a" opacity=".7" />
        ))}
        {(() => {
          const [sx, sy] = polar(47, 42);
          return (
            <g transform={`translate(${sx} ${sy})`}>
              <g className="afr-spin">
                <circle r="13.5" fill="none" />
                {Array.from({ length: 10 }, (_, i) => (
                  <line key={i} x1="0" y1="-9.5" x2="0" y2="-13" stroke="#ffb400" strokeWidth="1.6" strokeLinecap="round" transform={`rotate(${i * 36})`} />
                ))}
              </g>
              <circle r="7.2" fill="#ffd93d" stroke="#f59e0b" strokeWidth="1.2" />
            </g>
          );
        })()}
        <path d="M32 107.5q4.6-5 9.2 0t9.2 0 9.2 0 9.2 0 9.2 0" fill="none" stroke="#3dbbe8" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M38 111q4-4 8 0t8 0 8 0 8 0" fill="none" stroke="#9be4ff" strokeWidth="1.6" strokeLinecap="round" opacity=".9" />
        {(() => {
          const [fx, fy] = polar(45, -132);
          const star = Array.from({ length: 10 }, (_, i) => {
            const a = (i * Math.PI) / 5 - Math.PI / 2;
            const rad = i % 2 ? 2.4 : 5.8;
            return `${r2(Math.cos(a) * rad)},${r2(Math.sin(a) * rad)}`;
          }).join(" ");
          return <polygon transform={`translate(${fx} ${fy}) rotate(-15)`} points={star} fill="#ff8a5c" stroke="#d9552b" strokeWidth=".8" strokeLinejoin="round" />;
        })()}
      </>
    );
  },

  mare: () => (
    <>
      <defs>
        <linearGradient id="afr-sea" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4cc9ff" />
          <stop offset="1" stopColor="#0b5fcf" />
        </linearGradient>
      </defs>
      <Ring r={43.2} w={5.4} stroke="url(#afr-sea)" />
      {Array.from({ length: 30 }, (_, i) => {
        const [x, y] = polar(45.4 + (i % 2 ? 0.5 : -0.3), i * 12);
        return <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 3 : 2.3} fill="#effcff" stroke="#9bdcf5" strokeWidth=".5" />;
      })}
      {([[100, 14, 2.6, 0], [111, 30, 1.7, .8], [106, 6, 1.3, 1.5], [14, 20, 2, .4]] as const).map(([x, y, r, d]) => (
        <circle key={`${x}${y}`} className="afr-float" style={{ "--d": `${d}s` } as React.CSSProperties} cx={x} cy={y} r={r} fill="#fff" fillOpacity=".18" stroke="#bfefff" strokeWidth=".9" />
      ))}
    </>
  ),

  pixel: () => {
    const palette = ["#ff4d6d", "#ffd23f", "#35d0ba", "#6c8cff"];
    const seen = new Set<string>();
    const cells: { x: number; y: number; fill: string }[] = [];
    for (let i = 0; i < 96; i++) {
      const [px, py] = polar(43, i * 3.75);
      const gx = Math.round(px / 4) * 4 - 2;
      const gy = Math.round(py / 4) * 4 - 2;
      const key = `${gx},${gy}`;
      if (seen.has(key)) continue;
      seen.add(key);
      cells.push({ x: gx, y: gy, fill: palette[Math.floor(cells.length / 3) % palette.length] });
    }
    const heart = [".XX.XX.", "XXXXXXX", "XXXXXXX", ".XXXXX.", "..XXX..", "...X..."];
    return (
      <g shapeRendering="crispEdges">
        <g className="afr-hue">
        {cells.map((cell) => (
          <rect key={`${cell.x},${cell.y}`} x={cell.x} y={cell.y} width="4" height="4" fill={cell.fill} stroke="#1a1030" strokeWidth=".6" />
        ))}
        </g>
        {[-1, 0, 1].map((k) => (
          <g key={k} className="afr-blink" style={{ "--d": `${(k + 1) * 0.35}s` } as React.CSSProperties}><g transform={`translate(${60 + k * 19 - 7.7} -9)`}>
            {heart.flatMap((row, ry) =>
              [...row].map((ch, rx) =>
                ch === "X" ? <rect key={`${rx}-${ry}`} x={rx * 2.2} y={ry * 2.2} width="2.2" height="2.2" fill={rx < 2 && ry < 2 ? "#ff9db0" : "#ff3b5c"} /> : null,
              ),
            )}
          </g></g>
        ))}
      </g>
    );
  },

  amor: () => (
    <>
      <defs>
        <linearGradient id="afr-love" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e1d3ff" />
          <stop offset=".55" stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#5b21b6" />
        </linearGradient>
      </defs>
      <Ring stroke="url(#afr-love)" />
      <Ring r={40.7} w={.8} stroke="#fff" opacity={.55} />
      <Ring r={46} w={.9} stroke="#c4a8ff" />
      <Heart x={60} y={14.5} s={2.3} fill="#b99cff" stroke="#fff" />
      {([[-62, 52, 1.2, "#f9a8d4", 0], [66, 53, 1.4, "#a78bfa", .7], [150, 50, 1, "#e9d5ff", 1.4], [-125, 50, 1.05, "#f0abfc", .3]] as const).map(([deg, rad, s, fill, d]) => {
        const [x, y] = polar(rad, deg);
        return <Heart key={deg} x={x} y={y} s={s} fill={fill} className="afr-float" style={{ "--d": `${d}s` } as React.CSSProperties} />;
      })}
    </>
  ),

  noite: () => {
    const [mx, my] = polar(52, -40);
    return (
      <>
        <defs>
          <linearGradient id="afr-night" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#4f46e5" />
            <stop offset="1" stopColor="#15123f" />
          </linearGradient>
          <mask id="afr-moon">
            <rect x="-12" y="-12" width="24" height="24" fill="#fff" />
            <circle cx="3.6" cy="-2.6" r="7.2" fill="#000" />
          </mask>
        </defs>
        <Ring stroke="url(#afr-night)" />
        <Ring r={46} w={.9} stroke="#8f86ff" />
        <Ring r={40.5} w={.9} stroke="#8f86ff" opacity={.7} />
        {Array.from({ length: 16 }, (_, i) => {
          const [x, y] = polar(43 + ((i * 3) % 3) - 1, i * 22.5 + 6);
          return <circle key={i} cx={x} cy={y} r={i % 4 === 0 ? 1.1 : .65} fill="#fff3b8" />;
        })}
        <g transform={`translate(${mx} ${my}) rotate(-20)`}>
          <circle r="9.5" fill="#ffe9a8" opacity=".18" />
          <circle r="8.2" fill="#ffe9a8" stroke="#f3c64b" strokeWidth=".8" mask="url(#afr-moon)" />
        </g>
        <Sparkle x={88} y={16} s={.9} fill="#fff3b8" delay={.1} />
        <Sparkle x={104} y={62} s={.7} fill="#c7c2ff" delay={.9} />
        <Sparkle x={30} y={100} s={.75} fill="#fff3b8" delay={.5} />
        <path d="M100 96l-12 6" stroke="#fff3b8" strokeWidth="1.2" strokeLinecap="round" opacity=".7" />
        <Sparkle x={101} y={95} s={.7} fill="#fff" delay={1.2} />
      </>
    );
  },

  grafite: () => {
    const splat = (x: number, y: number, s: number, fill: string, drips: number[]) => (
      <g key={`${x}${y}`} fill={fill}>
        <circle cx={x} cy={y} r={5.2 * s} className="afr-breathe" />
        {[[-6, -3, 2], [5, -5, 1.6], [7, 3, 1.3], [-4, 5, 1.5], [0, -8, 1.1]].map(([dx, dy, rr], i) => (
          <circle key={i} cx={x + dx * s} cy={y + dy * s} r={rr * s} />
        ))}
        {drips.map((dx, i) => (
          <rect key={i} className="afr-drip" style={{ "--d": `${(i + x % 3) * 0.6}s` } as React.CSSProperties} x={x + dx * s - 0.9 * s} y={y} width={1.8 * s} height={(9 + i * 3) * s} rx={0.9 * s} />
        ))}
      </g>
    );
    return (
      <>
        <Ring r={43} w={4} stroke="#9a96b0" />
        <Ring r={43} w={4} stroke="#6f6b88" dash="1.5 6" />
        <Ring r={45.6} w={.8} stroke="#4a4660" />
        <Ring r={40.6} w={.8} stroke="#4a4660" />
        {splat(...polar(46, 40), 1.1, "#ff8a1f", [-1, 2.5])}
        {splat(...polar(46, -50), 1, "#ff4fa3", [0])}
        {splat(...polar(44, -135), .9, "#35c8ff", [1.5])}
        {splat(...polar(44, 150), 1, "#7ae33b", [-2, 1.5])}
        {Array.from({ length: 18 }, (_, i) => {
          const [x, y] = polar(49 + (i % 3) * 1.4, i * 20 + 7);
          return <circle key={i} className="afr-twinkle" style={{ "--d": `${(i % 6) / 3}s` } as React.CSSProperties} cx={x} cy={y} r=".75" fill={["#ff8a1f", "#ff4fa3", "#35c8ff", "#7ae33b"][i % 4]} opacity=".85" />;
        })}
      </>
    );
  },

  neon: () => (
    <>
      <defs>
        <filter id="afr-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="1.7" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g filter="url(#afr-glow)">
        <Ring r={43} w={2.8} stroke="#22e5ff" />
        <g className="afr-spin-slow">
          <circle cx={C} cy={C} r="48" fill="none" />
          <Ring r={46.8} w={1.7} stroke="#ff3df2" dash="14 6" />
        </g>
      </g>
      {[45, 135, 225, 315].map((deg) => {
        const [x, y] = polar(46.8, deg);
        return <rect key={deg} x={x - 1.4} y={y - 1.4} width="2.8" height="2.8" fill="#fff" transform={`rotate(45 ${x} ${y})`} />;
      })}
    </>
  ),

  ninja: () => (
    <>
      <defs>
        <linearGradient id="afr-ninja" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#38bdf8" />
          <stop offset="1" stopColor="#1d4ed8" />
        </linearGradient>
      </defs>
      <Ring r={43} w={4} stroke="url(#afr-ninja)" />
      <Ring r={46} w={.9} stroke="#93c5fd" opacity={.8} />
      <g className="afr-spin-rev" style={{ animationDuration: "9s" }}>
        <Anchor />
        <Ring r={49.5} w={1.2} stroke="#60a5fa" dash="2 5" />
      </g>
      <g className="afr-spin" style={{ animationDuration: "5.5s" }}>
        <Anchor />
        {[0, 120, 240].map((deg) => {
          const [x, y] = polar(43, deg);
          return (
            <g key={deg} transform={`translate(${x} ${y}) rotate(${deg + 90})`}>
              <circle r="4" fill="#f97316" stroke="#fff" strokeWidth=".9" />
              <path d="M0-4C5.4-4 8.4-.6 6.4 4 7.6-1.4 4-3.6 0-2.4Z" fill="#f97316" stroke="#fff" strokeWidth=".7" />
              <circle r="1.1" fill="#7c2d12" />
            </g>
          );
        })}
      </g>
      <g className="afr-sway">
        <path d="M60-12C72-4 73 9 60 17 47 9 48-4 60-12Z" fill="#22c55e" stroke="#14532d" strokeWidth="1.2" strokeLinejoin="round" />
        <path d="M60-6C53-1 54 7 60 11 66 7 67-1 60-6Z" fill="none" stroke="#bbf7d0" strokeWidth="1.1" />
        <path d="M60-12V17" stroke="#14532d" strokeWidth="1" />
      </g>
    </>
  ),

  furia: () => (
    <>
      <Flames id="afr-furia" inner="#fff9c4" mid="#ffd23f" outer="#ff9800" from={-118} to={118} count={11} minH={14} maxH={25} />
      <Ring r={43} w={3.6} stroke="#fff7c2" />
      <Ring r={45.4} w={1} stroke="#ffb300" />
      {([[-62, 56], [70, 58], [-128, 54], [128, 54]] as const).map(([deg, rad], i) => {
        const [x, y] = polar(rad, deg);
        return (
          <path key={deg} className="afr-flicker" style={{ "--d": `${i * 0.3}s` } as React.CSSProperties} d={`M${x - 3} ${y - 2}L${x} ${y + 1}L${x - 1} ${y - 1}L${x + 3} ${y + 3}`} fill="none" stroke="#7dd3fc" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        );
      })}
    </>
  ),

  sabres: () => (
    <>
      <defs>
        <filter id="afr-sabre-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="1.8" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <Ring r={43} w={3.4} stroke="#94a3b8" />
      <Ring r={43} w={1} stroke="#e2e8f0" dash="3 3" />
      <Ring r={46} w={.8} stroke="#475569" />
      <g filter="url(#afr-sabre-glow)">
        <g className="afr-pulse">
          <line x1="30" y1="-12" x2="100" y2="30" stroke="#38bdf8" strokeWidth="6" strokeLinecap="round" opacity=".55" />
          <line x1="90" y1="-12" x2="20" y2="30" stroke="#f43f5e" strokeWidth="6" strokeLinecap="round" opacity=".55" />
        </g>
        <line x1="30" y1="-12" x2="100" y2="30" stroke="#e0f2fe" strokeWidth="2.4" strokeLinecap="round" />
        <line x1="90" y1="-12" x2="20" y2="30" stroke="#ffe4e6" strokeWidth="2.4" strokeLinecap="round" />
      </g>
      <line x1="22" y1="-17" x2="31" y2="-11.6" stroke="#64748b" strokeWidth="5.4" strokeLinecap="round" />
      <line x1="98" y1="-17" x2="89" y2="-11.6" stroke="#64748b" strokeWidth="5.4" strokeLinecap="round" />
      <line x1="24" y1="-15.6" x2="28" y2="-13.2" stroke="#e2e8f0" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="96" y1="-15.6" x2="92" y2="-13.2" stroke="#e2e8f0" strokeWidth="1.2" strokeLinecap="round" />
      <Sparkle x={60} y={9} s={1.1} fill="#fff" delay={0} />
      <Sparkle x={48} y={2} s={.6} fill="#bae6fd" delay={.5} />
      <Sparkle x={72} y={2} s={.6} fill="#fecdd3" delay={1} />
    </>
  ),

  codigo: () => (
    <>
      <defs>
        <filter id="afr-code-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="1.3" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <g filter="url(#afr-code-glow)">
        <Ring r={43} w={2.4} stroke="#22c55e" />
        <Ring r={46} w={.8} stroke="#86efac" opacity={.7} />
      </g>
      {Array.from({ length: 22 }, (_, i) => {
        const [x, y] = polar(49.5 + (i % 3) * 3.2, i * 16.4 + 4);
        return (
          <text key={i} className="afr-rain" style={{ "--d": `${(i % 7) * 0.3}s` } as React.CSSProperties} x={x} y={y} fontSize={7 + (i % 3)} fontWeight="700" fill={i % 5 === 0 ? "#d1fae5" : "#4ade80"} textAnchor="middle" fontFamily="ui-monospace, Menlo, monospace">
            {["0", "1", "7", "A", "0", "1", "9"][i % 7]}
          </text>
        );
      })}
    </>
  ),

  pirata: () => (
    <>
      <Ring r={43} w={6} stroke="#b9895a" />
      <Ring r={43} w={6} stroke="#e8c79a" dash="2.2 5.6" />
      <Ring r={46.2} w={.9} stroke="#6b4423" />
      <Ring r={40} w={.9} stroke="#6b4423" />
      <g className="afr-orbit" style={{ animationDuration: "18s" }}>
        <Anchor />
        {[40, 130, 220, 310].map((deg) => {
          const [x, y] = polar(51, deg);
          return (
            <g key={deg}>
              <circle cx={x} cy={y} r="3.9" fill="#fbbf24" stroke="#a16207" strokeWidth=".9" />
              <circle cx={x} cy={y} r="2.1" fill="none" stroke="#fde68a" strokeWidth=".7" />
            </g>
          );
        })}
      </g>
      <g className="afr-sway">
        <path d="M27 24C30 4 90 4 93 24 82 16 38 16 27 24Z" fill="#1f2937" stroke="#fbbf24" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M27 24C42 21 78 21 93 24" fill="none" stroke="#fbbf24" strokeWidth="1.4" />
        <circle cx="60" cy="11.5" r="4.4" fill="#f8fafc" />
        <rect x="57" y="14.5" width="6" height="2.6" rx="1" fill="#f8fafc" />
        <circle cx="58.2" cy="11" r="1" fill="#1f2937" />
        <circle cx="61.8" cy="11" r="1" fill="#1f2937" />
      </g>
      <Sparkle x={100} y={96} s={.8} fill="#fde68a" delay={.4} />
      <Sparkle x={18} y={98} s={.6} fill="#fde68a" delay={1} />
    </>
  ),

  portal: () => (
    <>
      <defs>
        <filter id="afr-portal-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="1.6" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <g filter="url(#afr-portal-glow)">
        <g className="afr-spin" style={{ animationDuration: "6s" }}>
          <Anchor />
          <Ring r={43} w={3.4} stroke="#fb923c" dash="9 3" />
        </g>
        <g className="afr-spin-rev" style={{ animationDuration: "9s" }}>
          <Anchor />
          <Ring r={47.5} w={1.6} stroke="#fdba74" dash="3 4" />
        </g>
      </g>
      {Array.from({ length: 14 }, (_, i) => {
        const [x, y] = polar(46 + (i % 3) * 4, i * 25.7);
        return <circle key={i} className="afr-twinkle" style={{ "--d": `${(i % 6) * 0.3}s` } as React.CSSProperties} cx={x} cy={y} r={1 + (i % 3) * 0.5} fill={i % 2 ? "#fde68a" : "#fb923c"} />;
      })}
      <g className="afr-spin-slow">
        <Anchor />
        {[0, 90, 180, 270].map((deg) => {
          const [x, y] = polar(53, deg);
          return <path key={deg} d={`M${x} ${y - 3.2}L${x + 2.8} ${y + 2.4}L${x - 2.8} ${y + 2.4}Z`} fill="#ffedd5" stroke="#fb923c" strokeWidth=".7" strokeLinejoin="round" transform={`rotate(${deg} ${x} ${y})`} />;
        })}
      </g>
    </>
  ),

  gelo: () => (
    <>
      <defs>
        <linearGradient id="afr-ice" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f0fbff" />
          <stop offset="1" stopColor="#38bdf8" />
        </linearGradient>
      </defs>
      <Ring r={43} w={4} stroke="#bae6fd" />
      <Ring r={43} w={1.2} stroke="#fff" dash="4 5" />
      <Ring r={46} w={.9} stroke="#7dd3fc" />
      {([[-54, 14], [-34, 22], [-14, 29], [14, 29], [34, 22], [54, 14]] as const).map(([deg, h], i) => {
        const [x1, y1] = polar(41, deg - 5.5);
        const [x2, y2] = polar(41, deg + 5.5);
        const [tx, ty] = polar(41 + h, deg);
        return (
          <g key={deg} className="afr-breathe" style={{ animationDelay: `${i * 0.3}s` }}>
            <polygon points={`${x1},${y1} ${tx},${ty} ${x2},${y2}`} fill="url(#afr-ice)" stroke="#7dd3fc" strokeWidth="1" strokeLinejoin="round" />
            <line x1={(x1 + x2) / 2} y1={(y1 + y2) / 2} x2={tx} y2={ty} stroke="#fff" strokeOpacity=".8" strokeWidth=".8" />
          </g>
        );
      })}
      {([[8, 100, 1], [112, 86, .8], [104, 8, .9], [14, 22, .7]] as const).map(([x, y, s], i) => (
        <g key={x} className="afr-float" style={{ "--d": `${i * 0.7}s` } as React.CSSProperties}>
          <Snowflake x={x} y={y} s={s} />
        </g>
      ))}
      <Sparkle x={60} y={-12} s={1} fill="#fff" delay={.3} />
      <Sparkle x={86} y={0} s={.6} fill="#e0f7ff" delay={.9} />
    </>
  ),

  esferas: () => (
    <>
      <Ring r={43} w={2.4} stroke="#fde68a" />
      <Ring r={45.6} w={.8} stroke="#fbbf24" opacity={.7} />
      <g className="afr-orbit" style={{ animationDuration: "16s" }}>
        <Anchor />
        {["#ef4444", "#f97316", "#facc15", "#22c55e", "#38bdf8", "#6366f1", "#d946ef"].map((fill, i) => {
          const [x, y] = polar(48, i * (360 / 7));
          return (
            <g key={fill}>
              <circle cx={x} cy={y} r="5.2" fill={fill} stroke="#fff" strokeWidth=".9" />
              <circle cx={x - 1.6} cy={y - 1.8} r="1.5" fill="#fff" opacity=".75" />
              <path d={`M${x} ${y - 2.6}l.8 1.8 1.9.1-1.5 1.2.5 1.9-1.7-1-1.7 1 .5-1.9-1.5-1.2 1.9-.1Z`} fill="#fff" opacity=".9" transform={`translate(0 .8) scale(.8)`} style={{ transformOrigin: `${x}px ${y}px` }} />
            </g>
          );
        })}
      </g>
      <Sparkle x={60} y={-14} s={.9} fill="#fff6bf" delay={.2} />
    </>
  ),

  floresta: () => (
    <>
      <Ring r={43} w={3.6} stroke="#3f8f4a" />
      <Ring r={43} w={1.2} stroke="#86d38f" dash="3 4" />
      <Ring r={46} w={.8} stroke="#25612d" />
      {Array.from({ length: 12 }, (_, i) => {
        const deg = i * 30 + 10;
        const [x, y] = polar(45, deg);
        return (
          <g key={i} className="afr-sway" style={{ "--d": `${(i % 5) * 0.4}s` } as React.CSSProperties}>
            <ellipse cx={x} cy={y} rx="5" ry="2.4" fill={i % 2 ? "#4ade80" : "#22a653"} stroke="#14532d" strokeWidth=".6" transform={`rotate(${deg + 90 + (i % 2 ? 25 : -25)} ${x} ${y})`} />
          </g>
        );
      })}
      {([[30, 12, 0], [92, 8, 1], [108, 40, .5], [10, 50, 1.4], [100, 104, .8], [18, 96, 1.8]] as const).map(([x, y, d], i) => (
        <g key={`${x}${y}`} className="afr-float" style={{ "--d": `${d}s` } as React.CSSProperties}>
          <circle cx={x} cy={y} r={3 + (i % 2)} fill="#fffbd0" opacity=".35" />
          <circle cx={x} cy={y} r={1.5 + (i % 2) * 0.4} fill="#fffde0" />
        </g>
      ))}
      <g transform="translate(96 99)">
        <path d="M-6 0C-6-7 6-7 6 0Z" fill="#ef4444" stroke="#7f1d1d" strokeWidth=".9" />
        <circle cx="-2.2" cy="-3" r="1.1" fill="#fff" />
        <circle cx="2.4" cy="-2" r=".9" fill="#fff" />
        <rect x="-2" y="0" width="4" height="5" rx="1" fill="#fef3c7" stroke="#a16207" strokeWidth=".7" />
      </g>
    </>
  ),

  noturno: () => (
    <>
      <circle cx="60" cy="2" r="16" fill="#fff3c4" opacity=".28" />
      <circle cx="60" cy="2" r="12" fill="#fef3c7" />
      <circle cx="55" cy="-1" r="2" fill="#f5deb3" />
      <circle cx="65" cy="5" r="1.5" fill="#f5deb3" />
      <Ring r={43} w={5} stroke="#111827" />
      <Ring r={43} w={1.2} stroke="#a78bfa" dash="1 5" />
      <Ring r={46} w={1} stroke="#6b7280" />
      <Ring r={40.5} w={1} stroke="#6b7280" />
      {([[60, 2, 1.7, 0], [28, 12, 1.1, .2], [94, 16, 1.2, .4], [12, 70, .9, .1], [108, 76, 1, .35]] as const).map(([x, y, s, d]) => (
        <g key={`${x}${y}`} className="afr-flap" style={{ "--d": `${d}s` } as React.CSSProperties}>
          <path d={BAT} transform={`translate(${x} ${y}) scale(${s})`} fill="#0b0b14" stroke="#a78bfa" strokeWidth=".7" strokeLinejoin="round" />
        </g>
      ))}
      <Sparkle x={86} y={-6} s={.6} fill="#fff7c2" delay={.5} />
      <Sparkle x={34} y={-8} s={.5} fill="#fff7c2" delay={1.1} />
    </>
  ),

  blocos: () => {
    const tones = ["#4ade80", "#22a653", "#a16207", "#78716c", "#57534e"];
    return (
      <g shapeRendering="crispEdges">
        {Array.from({ length: 28 }, (_, i) => {
          const [x, y] = polar(43, i * (360 / 28));
          return <rect key={i} x={x - 3} y={y - 3} width="6" height="6" fill={tones[i % tones.length]} stroke="#1c1917" strokeWidth=".8" />;
        })}
        {Array.from({ length: 14 }, (_, i) => {
          const [x, y] = polar(43, i * (360 / 14));
          return <rect key={`h${i}`} x={x - 3} y={y - 3} width="6" height="2" fill="#bbf7d0" opacity=".55" />;
        })}
        {([[26, -6, 0], [92, -10, .6], [108, 100, 1.2], [14, 94, 1.8]] as const).map(([x, y, d], i) => (
          <g key={`${x}${y}`} className="afr-float" style={{ "--d": `${d}s` } as React.CSSProperties}>
            <rect x={x} y={y} width="8" height="8" fill={["#4ade80", "#38bdf8", "#f59e0b", "#e11d48"][i]} stroke="#1c1917" strokeWidth=".9" />
            <rect x={x} y={y} width="8" height="2.6" fill="#fff" opacity=".4" />
          </g>
        ))}
      </g>
    );
  },

  hiperespaco: () => (
    <>
      <Ring r={43} w={2.6} stroke="#7dd3fc" />
      <Ring r={45.8} w={.8} stroke="#e0f2fe" opacity={.8} />
      <g className="afr-spin-slow" style={{ animationDuration: "12s" }}>
        <Anchor />
        {Array.from({ length: 26 }, (_, i) => {
          const deg = i * (360 / 26);
          const len = 5 + ((i * 5) % 4) * 3.2;
          const [x1, y1] = polar(47, deg);
          const [x2, y2] = polar(47 + len, deg);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={i % 3 === 0 ? "#fff" : i % 3 === 1 ? "#93c5fd" : "#c4b5fd"} strokeWidth={i % 4 === 0 ? 1.7 : 1} strokeLinecap="round" opacity={0.55 + (i % 3) * 0.2} />;
        })}
      </g>
      <g className="afr-pulse">
        {Array.from({ length: 10 }, (_, i) => {
          const [x, y] = polar(60, i * 36 + 12);
          return <circle key={i} cx={x} cy={y} r={0.9 + (i % 3) * 0.4} fill="#fff" />;
        })}
      </g>
      <Sparkle x={104} y={8} s={.8} fill="#fff" delay={.2} />
      <Sparkle x={14} y={98} s={.7} fill="#bae6fd" delay={.9} />
    </>
  ),

  chama: () => (
    <>
      <Flames id="afr-chama" inner="#e0f2fe" mid="#3b82f6" outer="#7c3aed" from={-140} to={140} count={15} minH={10} maxH={22} />
      <Ring r={43} w={3.4} stroke="#dbeafe" />
      <Ring r={45.4} w={1} stroke="#6366f1" />
      {Array.from({ length: 8 }, (_, i) => {
        const [x, y] = polar(56 + (i % 3) * 3, i * 45 + 20);
        return <circle key={i} className="afr-float" style={{ "--d": `${(i % 4) * 0.5}s` } as React.CSSProperties} cx={x} cy={y} r={1 + (i % 2)} fill="#93c5fd" opacity=".85" />;
      })}
    </>
  ),

};

export function AvatarFrameArt({ id, still }: { id: AvatarFrameId; still?: boolean }) {
  const draw = FRAMES[id];
  if (!draw) return null;
  return (
    <svg className={`avatar-frame-art${still ? " avatar-frame-art--still" : ""}`} viewBox="-8 -26 136 136" aria-hidden focusable="false">
      <defs>
        {/* Recorte: a moldura nunca cobre a foto (círculo de raio 40). */}
        <clipPath id="afr-hole">
          <path clipRule="evenodd" d="M-8-26H128V110H-8ZM100 60A40 40 0 1 0 20 60A40 40 0 1 0 100 60Z" />
        </clipPath>
      </defs>
      <g clipPath="url(#afr-hole)">{draw()}</g>
    </svg>
  );
}
