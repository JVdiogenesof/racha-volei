import {
  BadgeCheck, CalendarCheck, Cake, Crown, Flame, Handshake, Hourglass, Medal, Rocket, Sprout, Star, Sword, Swords,
  Target, TrendingUp, Trophy, Users, Volleyball, Zap, type LucideIcon,
} from "lucide-react";

/** Ícone de cada curiosidade do card "VPA em números" (a chave é o id da curiosidade). */
const INSIGHT_ICONS: Record<string, LucideIcon> = {
  presenca: Volleyball,
  mes: CalendarCheck,
  sequencia: Flame,
  destaques: Star,
  vitorias: Trophy,
  aproveitamento: Target,
  saldo: TrendingUp,
  marcados: Zap,
  indice: Medal,
  subiu: Rocket,
  veteranos: Hourglass,
  novatos: Sprout,
  aniversarios: Cake,
  rivais: Swords,
  duplas: Handshake,
  "duplas-vitorias": Crown,
  freguesia: Sword,
  jogos: Volleyball,
  jogadores: Users,
  presencas: BadgeCheck,
};

/** Quadradinho roxo com o símbolo em dourado: a identidade visual das curiosidades. */
export function GoldIcon({ name, size = "md" }: { name: string; size?: "md" | "lg" }) {
  const Icon = INSIGHT_ICONS[name] ?? Star;
  const box = size === "lg" ? "h-9 w-9 rounded-xl" : "h-7 w-7 rounded-lg";
  const glyph = size === "lg" ? "h-5 w-5" : "h-4 w-4";
  return (
    <span className={`inline-flex shrink-0 items-center justify-center bg-gradient-to-br from-purple-500/70 to-[#2b1170] ring-1 ring-amber-300/45 shadow-[0_0_10px_rgba(251,191,36,0.18)] ${box}`}>
      <Icon className={`${glyph} text-amber-300 drop-shadow-[0_0_3px_rgba(251,191,36,0.6)]`} strokeWidth={2.2} aria-hidden />
    </span>
  );
}

const RANK_COLORS = [
  { from: "#fff3b0", to: "#e8960b", edge: "#7a4a00" }, // ouro
  { from: "#f5f3ff", to: "#a78bfa", edge: "#4c1d95" }, // prata lilás
  { from: "#ffd9a8", to: "#c2681c", edge: "#6b2f06" }, // cobre
];

/** Selo de posição (1º, 2º, 3º) desenhado por nós: escudo com brilho e número em roxo escuro. */
export function RankBadge({ position }: { position: 1 | 2 | 3 }) {
  const color = RANK_COLORS[position - 1];
  const id = `rank-${position}`;
  return (
    <svg viewBox="0 0 24 28" className="h-[22px] w-[19px] shrink-0" role="img" aria-label={`${position}º lugar`}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={color.from} />
          <stop offset="1" stopColor={color.to} />
        </linearGradient>
      </defs>
      <path d="M12 1.5 21.5 5v8.2c0 6-4.2 10.6-9.5 13.3C6.7 23.8 2.5 19.2 2.5 13.2V5L12 1.5Z" fill={`url(#${id})`} stroke={color.edge} strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M12 4.2 18.8 6.7v6.3c0 4.4-2.9 7.8-6.8 10-3.9-2.2-6.8-5.6-6.8-10V6.7L12 4.2Z" fill="none" stroke="#fff" strokeOpacity=".45" strokeWidth=".8" />
      <text x="12" y="16.6" textAnchor="middle" fontSize="11.5" fontWeight="900" fill="#2b1170" fontFamily="system-ui, sans-serif">{position}</text>
    </svg>
  );
}
