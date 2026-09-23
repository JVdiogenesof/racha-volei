export type AchievementStats = {
  attendance: number;
  wins: number;
  mvp: number;
  streak: number;
  isSetter: boolean;
};

export type Achievement = {
  id: string;
  title: string;
  description: string;
  emoji: string;
  current: number;
  target: number;
  unlocked: boolean;
  tier: "bronze" | "silver" | "gold" | "special";
};

type Definition = Omit<Achievement, "current" | "unlocked"> & {
  value: (stats: AchievementStats) => number;
};

const DEFINITIONS: Definition[] = [
  { id: "estreia", title: "Estreia na quadra", description: "Participou do primeiro racha.", emoji: "🏐", target: 1, tier: "bronze", value: (s) => s.attendance },
  { id: "presenca-5", title: "Presença garantida", description: "Participou de 5 rachas.", emoji: "📅", target: 5, tier: "silver", value: (s) => s.attendance },
  { id: "veterano", title: "Veterano da resenha", description: "Participou de 10 rachas.", emoji: "🎖️", target: 10, tier: "gold", value: (s) => s.attendance },
  { id: "lenda", title: "Lenda da quadra", description: "Participou de 25 rachas.", emoji: "🌟", target: 25, tier: "special", value: (s) => s.attendance },
  { id: "primeira-vitoria", title: "Primeira vitória", description: "Conquistou a primeira vitória.", emoji: "✌️", target: 1, tier: "bronze", value: (s) => s.wins },
  { id: "vencedor-5", title: "Sequência vencedora", description: "Chegou a 5 vitórias.", emoji: "🔥", target: 5, tier: "silver", value: (s) => s.wins },
  { id: "vencedor-15", title: "Máquina de vitórias", description: "Chegou a 15 vitórias.", emoji: "⚡", target: 15, tier: "gold", value: (s) => s.wins },
  { id: "vencedor-30", title: "Dono da quadra", description: "Chegou a 30 vitórias.", emoji: "👑", target: 30, tier: "special", value: (s) => s.wins },
  { id: "primeiro-mvp", title: "Brilhou na noite", description: "Foi escolhido Jogador Destaque.", emoji: "🏆", target: 1, tier: "bronze", value: (s) => s.mvp },
  { id: "mvp-3", title: "Craque da galera", description: "Foi destaque 3 vezes.", emoji: "💎", target: 3, tier: "gold", value: (s) => s.mvp },
  { id: "mvp-10", title: "Inesquecível", description: "Foi destaque 10 vezes.", emoji: "✨", target: 10, tier: "special", value: (s) => s.mvp },
  { id: "streak-3", title: "Fogo aceso", description: "Participou de 3 rachas seguidos.", emoji: "🔥", target: 3, tier: "bronze", value: (s) => s.streak },
  { id: "streak-5", title: "Sempre presente", description: "Participou de 5 rachas seguidos.", emoji: "💪", target: 5, tier: "silver", value: (s) => s.streak },
  { id: "streak-10", title: "Maratonista", description: "Participou de 10 rachas seguidos.", emoji: "🚀", target: 10, tier: "special", value: (s) => s.streak },
  { id: "levantador", title: "Maestro da rede", description: "Joga como levantador do grupo.", emoji: "🪄", target: 1, tier: "special", value: (s) => (s.isSetter ? 1 : 0) },
];

const TIER_WEIGHT: Record<Achievement["tier"], number> = {
  bronze: 1,
  silver: 2,
  gold: 3,
  special: 4,
};

export function getPlayerAchievements(stats: AchievementStats): Achievement[] {
  return DEFINITIONS.map((definition) => {
    const current = Math.max(0, definition.value(stats));
    return {
      ...definition,
      current,
      unlocked: current >= definition.target,
    };
  });
}

export function getFeaturedAchievements(stats: AchievementStats, limit = 3) {
  return getPlayerAchievements(stats)
    .filter((achievement) => achievement.unlocked)
    .sort((a, b) => TIER_WEIGHT[b.tier] - TIER_WEIGHT[a.tier] || b.target - a.target)
    .slice(0, limit);
}
