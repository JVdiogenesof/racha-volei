import type { GlyphId } from "@/components/AchievementEmblem";

/**
 * Conquistas: cada TRILHA (presença, vitórias, destaque, sequência, torneios,
 * medalhas...) tem 4 níveis -- Bronze, Prata, Ouro e Lendário -- e alguns
 * níveis destravam cosméticos (moldura, banner ou efeito de perfil). Cada nível
 * também dá XP, que sobe o "Nível VPA" da pessoa. Tudo é calculado na hora a
 * partir das estatísticas: não há tabela de conquistas pra manter.
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
  /** Partidas jogadas (com resultado lançado). */
  matches?: number;
  /** Pontos marcados pelos times em que jogou. */
  points?: number;
  /** Rachas em que venceu todas as partidas (mínimo 2). */
  perfectDays?: number;
  /** Companheiros de time diferentes. */
  teammates?: number;
  /** Fins de semana com sábado e domingo jogados. */
  fullWeekends?: number;
};

type PlayMaps = {
  matches: Map<string, number>;
  points: Map<string, number>;
  perfectDays: Map<string, number>;
  teammates: Map<string, number>;
  fullWeekends: Map<string, number>;
};

/** Os números extras de uma pessoa, a partir do getRankingCounts. */
export function playStatsFor(counts: PlayMaps, profileId: string) {
  return {
    matches: counts.matches.get(profileId) ?? 0,
    points: counts.points.get(profileId) ?? 0,
    perfectDays: counts.perfectDays.get(profileId) ?? 0,
    teammates: counts.teammates.get(profileId) ?? 0,
    fullWeekends: counts.fullWeekends.get(profileId) ?? 0,
  } satisfies Partial<AchievementStats>;
}

export type AchievementTier = "bronze" | "silver" | "gold" | "legend";
export type AchievementCategory = "frequencia" | "vitorias" | "destaque" | "torneios" | "resenha" | "especiais";

export const TIER_ORDER: AchievementTier[] = ["bronze", "silver", "gold", "legend"];
export const TIER_LABEL: Record<AchievementTier, string> = { bronze: "Bronze", silver: "Prata", gold: "Ouro", legend: "Lendário" };
export const TIER_WEIGHT: Record<AchievementTier, number> = { bronze: 1, silver: 2, gold: 3, legend: 4 };
/** XP que cada nível alcançado soma ao Nível VPA. */
export const TIER_XP: Record<AchievementTier, number> = { bronze: 10, silver: 20, gold: 35, legend: 60 };

export const CATEGORY_LABEL: Record<AchievementCategory, string> = {
  frequencia: "Frequência",
  vitorias: "Vitórias",
  destaque: "Destaques",
  torneios: "Torneios",
  resenha: "Resenha",
  especiais: "Especiais",
};

/** Cosméticos liberados por um nível: tipo + id no catálogo (lib/cosmetics.ts, lib/avatarFrames.ts). */
export type Reward = { kind: "frame" | "banner" | "effect"; id: string };

type TrackDefinition = {
  id: string;
  category: AchievementCategory;
  title: string;
  description: string;
  glyph: GlyphId;
  unit: string;
  /** Metas dos 4 níveis, na ordem Bronze → Lendário. */
  targets: [number, number, number, number];
  rewards: Partial<Record<AchievementTier, Reward[]>>;
  value: (stats: AchievementStats) => number;
};

const TRACKS: TrackDefinition[] = [
  {
    id: "presenca", category: "frequencia", title: "Presença", glyph: "calendar", unit: "rachas",
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
    id: "sequencia", category: "frequencia", title: "Sequência", glyph: "flame", unit: "rachas seguidos",
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
    id: "rodagem", category: "frequencia", title: "Rodagem", glyph: "ball", unit: "partidas",
    description: "Partidas jogadas nos rachas, ganhando ou perdendo.",
    targets: [10, 25, 50, 100],
    rewards: {},
    value: (s) => s.matches ?? 0,
  },
  {
    id: "fimdesemana", category: "frequencia", title: "Fim de Semana Completo", glyph: "weekend", unit: "fins de semana",
    description: "Jogou o racha de sábado e o de domingo do mesmo fim de semana.",
    targets: [1, 2, 4, 8],
    rewards: {},
    value: (s) => s.fullWeekends ?? 0,
  },
  {
    id: "vitorias", category: "vitorias", title: "Vitórias", glyph: "bolt", unit: "vitórias",
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
    id: "invicto", category: "vitorias", title: "Dia Invicto", glyph: "shield", unit: "rachas invictos",
    description: "Rachas em que você venceu todas as partidas que jogou (pelo menos 2).",
    targets: [1, 2, 4, 7],
    rewards: {},
    value: (s) => s.perfectDays ?? 0,
  },
  {
    id: "pontos", category: "vitorias", title: "Pontuador", glyph: "target", unit: "pontos",
    description: "Pontos marcados pelos times em que você jogou (dos jogos com placar lançado).",
    targets: [50, 150, 400, 1000],
    rewards: {},
    value: (s) => s.points ?? 0,
  },
  {
    id: "destaque", category: "destaque", title: "Destaque", glyph: "trophy", unit: "destaques",
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
    id: "torneios", category: "torneios", title: "Torneios", glyph: "medal", unit: "medalhas de torneio",
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
    id: "parceiros", category: "resenha", title: "Enturmado", glyph: "users", unit: "parceiros de time",
    description: "Pessoas diferentes com quem você já jogou no mesmo time.",
    targets: [15, 30, 50, 70],
    rewards: {},
    value: (s) => s.teammates ?? 0,
  },
  {
    id: "colecao", category: "especiais", title: "Colecionador", glyph: "rosette", unit: "medalhas",
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
    id: "maestro", category: "especiais", title: "Maestro da rede", glyph: "setter", unit: "",
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
  glyph: GlyphId;
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
      glyph: def.glyph,
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

// ── Nível VPA (XP) ─────────────────────────────────────────────────────────────

const LEVELS: { at: number; title: string }[] = [
  { at: 0, title: "Estreante" },
  { at: 20, title: "Aquecendo" },
  { at: 50, title: "Titular" },
  { at: 90, title: "Rodado" },
  { at: 140, title: "Raçudo" },
  { at: 200, title: "Veterano" },
  { at: 280, title: "Craque" },
  { at: 380, title: "Fera" },
  { at: 500, title: "Monstro" },
  { at: 650, title: "Ídolo" },
  { at: 850, title: "Lenda" },
  { at: 1100, title: "Hall da Fama" },
];

export type VpaLevel = { level: number; title: string; xp: number; floor: number; nextAt: number | null; nextTitle: string | null; percent: number };

/** Soma o XP dos níveis alcançados e devolve o Nível VPA (1 a 12) com o título. */
export function getVpaLevel(tracks: AchievementTrack[]): VpaLevel {
  const xp = tracks.reduce((sum, track) => sum + track.levels.filter((level) => level.unlocked).reduce((acc, level) => acc + TIER_XP[level.tier], 0), 0);
  let index = 0;
  for (let i = 0; i < LEVELS.length; i++) if (xp >= LEVELS[i].at) index = i;
  const floor = LEVELS[index].at;
  const next = LEVELS[index + 1] ?? null;
  return {
    level: index + 1,
    title: LEVELS[index].title,
    xp,
    floor,
    nextAt: next?.at ?? null,
    nextTitle: next?.title ?? null,
    percent: next ? Math.round(((xp - floor) / (next.at - floor)) * 100) : 100,
  };
}

/** As trilhas mais perto de subir de nível (o "falta pouco" que puxa a pessoa de volta). */
export function getNearestGoals(tracks: AchievementTrack[], limit = 3) {
  return tracks
    .filter((track) => track.next && track.levels.length > 1 && track.current > 0)
    .map((track) => ({ track, missing: track.next!.target - track.current }))
    .sort((a, b) => b.track.percentToNext - a.track.percentToNext || a.missing - b.missing)
    .slice(0, limit);
}

// ── Formato "plano" (uma linha por trilha) usado pelos cartões de jogador ──────

export type Achievement = {
  id: string;
  title: string;
  description: string;
  glyph: GlyphId;
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
      glyph: track.glyph,
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
  { id: "estreia", title: "Estreia no VPA", description: "Participou do primeiro racha.", glyph: "ball", target: 1, tier: "bronze", value: (s) => s.attendance },
  { id: "presenca-5", title: "Presença garantida", description: "Participou de 5 rachas.", glyph: "calendar", target: 5, tier: "silver", value: (s) => s.attendance },
  { id: "veterano", title: "Veterano da resenha", description: "Participou de 10 rachas.", glyph: "rosette", target: 10, tier: "gold", value: (s) => s.attendance },
  { id: "lenda", title: "Lenda do VPA", description: "Participou de 25 rachas.", glyph: "star", target: 25, tier: "legend", value: (s) => s.attendance },
  { id: "primeira-vitoria", title: "Primeira vitória", description: "Conquistou a primeira vitória.", glyph: "bolt", target: 1, tier: "bronze", value: (s) => s.wins },
  { id: "vencedor-5", title: "Sequência vencedora", description: "Chegou a 5 vitórias.", glyph: "rise", target: 5, tier: "silver", value: (s) => s.wins },
  { id: "vencedor-15", title: "Máquina de vitórias", description: "Chegou a 15 vitórias.", glyph: "bolt", target: 15, tier: "gold", value: (s) => s.wins },
  { id: "vencedor-30", title: "Dono do jogo", description: "Chegou a 30 vitórias.", glyph: "crown", target: 30, tier: "legend", value: (s) => s.wins },
  { id: "primeiro-mvp", title: "Brilhou na noite", description: "Foi escolhido Jogador Destaque.", glyph: "trophy", target: 1, tier: "bronze", value: (s) => s.mvp },
  { id: "mvp-3", title: "Craque da galera", description: "Foi destaque 3 vezes.", glyph: "gem", target: 3, tier: "gold", value: (s) => s.mvp },
  { id: "mvp-10", title: "Inesquecível", description: "Foi destaque 10 vezes.", glyph: "star", target: 10, tier: "legend", value: (s) => s.mvp },
  { id: "streak-3", title: "Fogo aceso", description: "Participou de 3 rachas seguidos.", glyph: "flame", target: 3, tier: "bronze", value: (s) => s.streak },
  { id: "streak-5", title: "Sempre presente", description: "Participou de 5 rachas seguidos.", glyph: "calendar", target: 5, tier: "silver", value: (s) => s.streak },
  { id: "streak-10", title: "Maratonista", description: "Participou de 10 rachas seguidos.", glyph: "rocket", target: 10, tier: "legend", value: (s) => s.streak },
  { id: "levantador", title: "Maestro da rede", description: "Joga como levantador do grupo.", glyph: "setter", target: 1, tier: "legend", value: (s) => (s.isSetter ? 1 : 0) },
];

export function getClassicAchievements(stats: AchievementStats): Achievement[] {
  return CLASSICS.map(({ value, ...definition }) => {
    const current = Math.max(0, value(stats));
    return { ...definition, current, unlocked: current >= definition.target };
  });
}
