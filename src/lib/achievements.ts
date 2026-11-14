/**
 * Conquistas: cada TRILHA (frequência, vitórias, destaque, sequência, torneios,
 * medalhas) tem 4 níveis -- Bronze, Prata, Ouro e Lendário -- e cada nível
 * destrava cosméticos (moldura, banner ou efeito de perfil). Tudo é calculado
 * na hora a partir das estatísticas: não há tabela de conquistas pra manter.
 */
export type AchievementStats = {
  attendance: number;
  wins: number;
  mvp: number;
  streak: number;
  isSetter: boolean;
  /** Medalhas de torneio recebidas (distribuídas pelo organizador). */
  tournamentBadges?: number;
  /** Total de medalhas recebidas. */
  badgeCount?: number;
};

export type AchievementTier = "bronze" | "silver" | "gold" | "legend";
export type AchievementCategory = "frequencia" | "vitorias" | "destaque" | "torneios" | "especiais";

export const TIER_ORDER: AchievementTier[] = ["bronze", "silver", "gold", "legend"];
export const TIER_LABEL: Record<AchievementTier, string> = { bronze: "Bronze", silver: "Prata", gold: "Ouro", legend: "Lendário" };
export const TIER_WEIGHT: Record<AchievementTier, number> = { bronze: 1, silver: 2, gold: 3, legend: 4 };

export const CATEGORY_LABEL: Record<AchievementCategory, string> = {
  frequencia: "Frequência",
  vitorias: "Vitórias",
  destaque: "Destaques",
  torneios: "Torneios",
  especiais: "Especiais",
};

/** Cosméticos liberados por um nível: tipo + id no catálogo (lib/cosmetics.ts, lib/avatarFrames.ts). */
export type Reward = { kind: "frame" | "banner" | "effect"; id: string };

type TrackDefinition = {
  id: string;
  category: AchievementCategory;
  title: string;
  description: string;
  emoji: string;
  unit: string;
  /** Metas dos 4 níveis, na ordem Bronze → Lendário. */
  targets: [number, number, number, number];
  rewards: Partial<Record<AchievementTier, Reward[]>>;
  value: (stats: AchievementStats) => number;
};

const TRACKS: TrackDefinition[] = [
  {
    id: "presenca", category: "frequencia", title: "Presença", emoji: "📅", unit: "rachas",
    description: "Quantos rachas você já jogou no VPA.",
    targets: [1, 5, 10, 20],
    rewards: {
      bronze: [{ kind: "banner", id: "cidade" }, { kind: "effect", id: "chuva" }],
      silver: [{ kind: "banner", id: "neon" }, { kind: "effect", id: "estrelas" }],
      gold: [{ kind: "banner", id: "tropical" }, { kind: "effect", id: "neon" }],
      legend: [{ kind: "frame", id: "aura" }],
    },
    value: (s) => s.attendance,
  },
  {
    id: "sequencia", category: "frequencia", title: "Sequência", emoji: "🔥", unit: "rachas seguidos",
    description: "Rachas seguidos sem faltar.",
    targets: [3, 5, 8, 10],
    rewards: {
      bronze: [{ kind: "banner", id: "noite" }],
      silver: [{ kind: "effect", id: "brasas" }, { kind: "frame", id: "grafite" }],
      gold: [{ kind: "banner", id: "fornalha" }],
      legend: [{ kind: "frame", id: "neon" }],
    },
    value: (s) => s.streak,
  },
  {
    id: "vitorias", category: "vitorias", title: "Vitórias", emoji: "⚡", unit: "vitórias",
    description: "Partidas vencidas nos rachas.",
    targets: [1, 5, 15, 30],
    rewards: {
      bronze: [{ kind: "effect", id: "raios" }, { kind: "frame", id: "trovao" }, { kind: "banner", id: "ginasio" }],
      silver: [{ kind: "banner", id: "trovoada" }, { kind: "frame", id: "cortada" }],
      gold: [{ kind: "effect", id: "dourado" }],
      legend: [{ kind: "frame", id: "coroa" }],
    },
    value: (s) => s.wins,
  },
  {
    id: "destaque", category: "destaque", title: "Destaque", emoji: "🏆", unit: "destaques",
    description: "Vezes eleito Jogador Destaque do racha.",
    targets: [1, 3, 5, 10],
    rewards: {
      bronze: [{ kind: "banner", id: "arena" }],
      silver: [{ kind: "effect", id: "ondas" }, { kind: "frame", id: "magica" }, { kind: "banner", id: "aurora" }],
      gold: [{ kind: "banner", id: "galaxia" }],
      legend: [{ kind: "banner", id: "lendario" }],
    },
    value: (s) => s.mvp,
  },
  {
    id: "torneios", category: "torneios", title: "Torneios", emoji: "🥇", unit: "medalhas de torneio",
    description: "Medalhas de torneios e campeonatos do VPA.",
    targets: [1, 2, 4, 6],
    rewards: {
      bronze: [{ kind: "banner", id: "podio" }],
      silver: [{ kind: "effect", id: "confete" }],
      gold: [{ kind: "banner", id: "logo-dourado" }],
    },
    value: (s) => s.tournamentBadges ?? 0,
  },
  {
    id: "colecao", category: "especiais", title: "Colecionador", emoji: "🎖️", unit: "medalhas",
    description: "Medalhas de eventos e momentos especiais.",
    targets: [1, 3, 6, 10],
    rewards: {
      bronze: [{ kind: "effect", id: "fogos" }],
      silver: [{ kind: "banner", id: "logo-neon" }],
      gold: [{ kind: "effect", id: "coroas" }],
    },
    value: (s) => s.badgeCount ?? 0,
  },
  {
    id: "maestro", category: "especiais", title: "Maestro da rede", emoji: "🪄", unit: "",
    description: "Joga como levantador(a) do grupo.",
    targets: [1, 1, 1, 1],
    rewards: {},
    value: (s) => (s.isSetter ? 1 : 0),
  },
];

export type AchievementLevel = {
  id: string; // ex.: "presenca-silver" (é o id gravado em seen_unlocks)
  tier: AchievementTier;
  target: number;
  unlocked: boolean;
  rewards: Reward[];
};

export type AchievementTrack = {
  id: string;
  category: AchievementCategory;
  title: string;
  description: string;
  emoji: string;
  unit: string;
  current: number;
  levels: AchievementLevel[];
  /** Maior nível já alcançado (ou null). */
  tier: AchievementTier | null;
  /** Próximo nível a conquistar (ou null se já é Lendário). */
  next: AchievementLevel | null;
  /** 0-100 rumo ao próximo nível (100 quando completo). */
  percentToNext: number;
};

export function getAchievementTracks(stats: AchievementStats): AchievementTrack[] {
  return TRACKS.map((def) => {
    const current = Math.max(0, def.value(stats));
    // Trilha de nível único (Maestro): só o Lendário conta, sem 4 degraus iguais.
    const single = def.targets[0] === def.targets[3];
    const levels: AchievementLevel[] = (single ? (["legend"] as AchievementTier[]) : TIER_ORDER).map((tier) => {
      const target = def.targets[TIER_ORDER.indexOf(tier)];
      return { id: `${def.id}-${tier}`, tier, target, unlocked: current >= target, rewards: def.rewards[tier] ?? [] };
    });
    const reached = levels.filter((level) => level.unlocked);
    const next = levels.find((level) => !level.unlocked) ?? null;
    const previousTarget = reached.length ? reached[reached.length - 1].target : 0;
    const percentToNext = next ? Math.min(100, Math.max(0, ((current - previousTarget) / (next.target - previousTarget)) * 100)) : 100;
    return {
      id: def.id,
      category: def.category,
      title: def.title,
      description: def.description,
      emoji: def.emoji,
      unit: def.unit,
      current,
      levels,
      tier: reached.length ? reached[reached.length - 1].tier : null,
      next,
      percentToNext,
    };
  });
}

/** Ids de todos os níveis já alcançados -- base do desbloqueio de cosméticos. */
export function getUnlockedLevelIds(stats: AchievementStats): Set<string> {
  const ids = new Set<string>();
  for (const track of getAchievementTracks(stats)) {
    for (const level of track.levels) if (level.unlocked) ids.add(level.id);
  }
  return ids;
}

// ── Formato "plano" (uma linha por trilha) usado pelos cartões de jogador ──────

export type Achievement = {
  id: string;
  title: string;
  description: string;
  emoji: string;
  current: number;
  target: number;
  unlocked: boolean;
  tier: AchievementTier;
};

export function getPlayerAchievements(stats: AchievementStats): Achievement[] {
  return getAchievementTracks(stats).map((track) => {
    const level = track.next ?? track.levels[track.levels.length - 1];
    const single = track.levels.length === 1;
    return {
      id: track.id,
      title: single || !track.tier ? track.title : `${track.title} · ${TIER_LABEL[track.tier]}`,
      description: track.description,
      emoji: track.emoji,
      current: track.current,
      target: level.target,
      unlocked: track.tier !== null,
      tier: track.tier ?? level.tier,
    };
  });
}

export function getFeaturedAchievements(stats: AchievementStats, limit = 3) {
  return getPlayerAchievements(stats)
    .filter((achievement) => achievement.unlocked)
    .sort((a, b) => TIER_WEIGHT[b.tier] - TIER_WEIGHT[a.tier] || b.target - a.target)
    .slice(0, limit);
}

/** Quantos níveis (somando todas as trilhas) a pessoa já alcançou. */
export function countUnlockedLevels(stats: AchievementStats) {
  return getUnlockedLevelIds(stats).size;
}

// ── Conquistas clássicas ───────────────────────────────────────────────────────
// A lista original do app, mantida igualzinha: quem já tinha continua com elas.

type ClassicDefinition = Omit<Achievement, "current" | "unlocked"> & { value: (stats: AchievementStats) => number };

const CLASSICS: ClassicDefinition[] = [
  { id: "estreia", title: "Estreia no VPA", description: "Participou do primeiro racha.", emoji: "🏐", target: 1, tier: "bronze", value: (s) => s.attendance },
  { id: "presenca-5", title: "Presença garantida", description: "Participou de 5 rachas.", emoji: "📅", target: 5, tier: "silver", value: (s) => s.attendance },
  { id: "veterano", title: "Veterano da resenha", description: "Participou de 10 rachas.", emoji: "🎖️", target: 10, tier: "gold", value: (s) => s.attendance },
  { id: "lenda", title: "Lenda do VPA", description: "Participou de 25 rachas.", emoji: "🌟", target: 25, tier: "legend", value: (s) => s.attendance },
  { id: "primeira-vitoria", title: "Primeira vitória", description: "Conquistou a primeira vitória.", emoji: "✌️", target: 1, tier: "bronze", value: (s) => s.wins },
  { id: "vencedor-5", title: "Sequência vencedora", description: "Chegou a 5 vitórias.", emoji: "🔥", target: 5, tier: "silver", value: (s) => s.wins },
  { id: "vencedor-15", title: "Máquina de vitórias", description: "Chegou a 15 vitórias.", emoji: "⚡", target: 15, tier: "gold", value: (s) => s.wins },
  { id: "vencedor-30", title: "Dono do jogo", description: "Chegou a 30 vitórias.", emoji: "👑", target: 30, tier: "legend", value: (s) => s.wins },
  { id: "primeiro-mvp", title: "Brilhou na noite", description: "Foi escolhido Jogador Destaque.", emoji: "🏆", target: 1, tier: "bronze", value: (s) => s.mvp },
  { id: "mvp-3", title: "Craque da galera", description: "Foi destaque 3 vezes.", emoji: "💎", target: 3, tier: "gold", value: (s) => s.mvp },
  { id: "mvp-10", title: "Inesquecível", description: "Foi destaque 10 vezes.", emoji: "✨", target: 10, tier: "legend", value: (s) => s.mvp },
  { id: "streak-3", title: "Fogo aceso", description: "Participou de 3 rachas seguidos.", emoji: "🔥", target: 3, tier: "bronze", value: (s) => s.streak },
  { id: "streak-5", title: "Sempre presente", description: "Participou de 5 rachas seguidos.", emoji: "💪", target: 5, tier: "silver", value: (s) => s.streak },
  { id: "streak-10", title: "Maratonista", description: "Participou de 10 rachas seguidos.", emoji: "🚀", target: 10, tier: "legend", value: (s) => s.streak },
  { id: "levantador", title: "Maestro da rede", description: "Joga como levantador do grupo.", emoji: "🪄", target: 1, tier: "legend", value: (s) => (s.isSetter ? 1 : 0) },
];

export function getClassicAchievements(stats: AchievementStats): Achievement[] {
  return CLASSICS.map(({ value, ...definition }) => {
    const current = Math.max(0, value(stats));
    return { ...definition, current, unlocked: current >= definition.target };
  });
}
