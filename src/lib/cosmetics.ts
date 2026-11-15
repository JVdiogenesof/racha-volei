/**
 * Catálogo de cosméticos de perfil: banners (capa do cartão) e efeitos
 * (animação por cima do cartão). As molduras da foto ficam em avatarFrames.ts.
 *
 * `unlock` é o id de um nível de conquista (ex.: "presenca-silver"); sem ele o
 * item é livre. Quem calcula o que está liberado é o servidor (cosmeticState.ts).
 */
export type CosmeticKind = "frame" | "banner" | "effect";

export const PROFILE_BANNERS = [
  { id: "quadra", name: "Quadra Clássica", tagline: "Piso de madeira e rede armada" },
  { id: "praia", name: "Praia do Futuro", tagline: "Sol, mar e areia fofa" },
  { id: "por-do-sol", name: "Pôr do Sol", tagline: "Cortada contra o céu laranja" },
  { id: "vpa", name: "Vôlei por Amor", tagline: "Coração-bola, como na nossa logo" },
  { id: "logo-roxo", name: "Logo VPA Roxo", tagline: "A nossa logo de verdade, em destaque" },
  { id: "logo-padrao", name: "Estampa VPA", tagline: "Logo em padrão, tipo papel de parede" },
  { id: "logo-colorida", name: "Logo VPA Original", tagline: "A logo azul em camisa listrada" },
  { id: "logo-quadra", name: "Logo na Quadra", tagline: "Quadra vista de cima, logo no piso" },
  { id: "ceu-azul", name: "Céu de Domingo", tagline: "Nuvens e bola no ar" },
  { id: "oceano", name: "Fundo do Mar", tagline: "Bolhas, coral e luz da superfície" },
  { id: "sakura", name: "Sakura", tagline: "Cerejeira em flor", },
  { id: "doce", name: "Pastel Fofo", tagline: "Corações e estrelinhas" },
  { id: "neon", name: "Neon Grid", tagline: "Quadra synthwave", unlock: "presenca-silver" },
  { id: "noite", name: "Noite de Estrelas", tagline: "Racha sob a lua", unlock: "sequencia-bronze" },
  { id: "tropical", name: "Rede Tropical", tagline: "Folhagem e luz do verão", unlock: "presenca-gold" },
  { id: "trovoada", name: "Tempestade", tagline: "Raios sobre a quadra", unlock: "vitorias-silver" },
  { id: "fornalha", name: "Fornalha", tagline: "Bola pegando fogo", unlock: "sequencia-gold" },
  { id: "arena", name: "Arena Lotada", tagline: "Refletores e torcida", unlock: "destaque-bronze" },
  { id: "podio", name: "Pódio Dourado", tagline: "1º, 2º e 3º lugares", unlock: "torneios-bronze" },
  { id: "galaxia", name: "Galáxia", tagline: "Um planeta-bola de outro mundo", unlock: "destaque-gold" },
  { id: "lendario", name: "Lenda do VPA", tagline: "Preto e ouro, só pra poucos", unlock: "destaque-legend" },
  { id: "cidade", name: "Cidade à Noite", tagline: "Prédios acesos e a bola fazendo de lua", unlock: "presenca-bronze" },
  { id: "ginasio", name: "Ginásio de Dia", tagline: "Janelões, placar e bandeirinhas", unlock: "vitorias-bronze" },
  { id: "aurora", name: "Aurora Boreal", tagline: "Luzes verdes sobre a montanha", unlock: "destaque-silver" },
  { id: "logo-neon", name: "Logo Neon", tagline: "Logo VPA brilhando no escuro", unlock: "colecao-silver" },
  { id: "logo-dourado", name: "Logo Dourada", tagline: "Logo VPA com raios de ouro", unlock: "torneios-gold" },
] as const satisfies readonly { id: string; name: string; tagline: string; unlock?: string }[];

export const PROFILE_EFFECTS = [
  { id: "areia", name: "Areia ao Vento", tagline: "Grãos voando pela quadra", emoji: "🏖️" },
  { id: "bolhas", name: "Maré de Bolhas", tagline: "Bolhas subindo devagar", emoji: "🫧" },
  { id: "coracoes", name: "Chuva de Corações", tagline: "Amor no ar, é VPA", emoji: "💜" },
  { id: "estrelas", name: "Chuva de Estrelas", tagline: "Estrelas cadentes", emoji: "🌠", unlock: "presenca-silver" },
  { id: "neon", name: "Brilho Neon", tagline: "Luz pulsando nas bordas", emoji: "🟣", unlock: "presenca-gold" },
  { id: "brasas", name: "Faíscas de Fogo", tagline: "Brasas subindo do cartão", emoji: "🔥", unlock: "sequencia-silver" },
  { id: "raios", name: "Tempestade", tagline: "Relâmpagos suaves", emoji: "⚡", unlock: "vitorias-bronze" },
  { id: "ondas", name: "Ondas de Energia", tagline: "Pulsos de energia", emoji: "🌀", unlock: "destaque-silver" },
  { id: "dourado", name: "Partículas Douradas", tagline: "Brilho de campeão", emoji: "✨", unlock: "vitorias-gold" },
  { id: "confete", name: "Festa de Campeão", tagline: "Confete caindo", emoji: "🎉", unlock: "torneios-silver" },
  { id: "logo", name: "Chuva de Logos", tagline: "A logo do VPA flutuando", emoji: "💜" },
  { id: "bolas", name: "Chuva de Bolas", tagline: "Bolas de vôlei caindo", emoji: "🏐" },
  { id: "neve", name: "Neve", tagline: "Flocos caindo devagar", emoji: "❄️" },
  { id: "vagalumes", name: "Vagalumes", tagline: "Luzinhas piscando na noite", emoji: "✨" },
  { id: "petalas", name: "Pétalas ao Vento", tagline: "Cerejeira soltando flores", emoji: "🌸" },
  { id: "chuva", name: "Chuva de Verão", tagline: "Gotas rápidas e frescas", emoji: "🌧️", unlock: "presenca-bronze" },
  { id: "fogos", name: "Fogos de Artifício", tagline: "Explosões coloridas", emoji: "🎆", unlock: "colecao-bronze" },
  { id: "coroas", name: "Chuva de Coroas", tagline: "Majestade em movimento", emoji: "👑", unlock: "colecao-gold" },
] as const satisfies readonly { id: string; name: string; tagline: string; emoji: string; unlock?: string }[];

export type BannerId = (typeof PROFILE_BANNERS)[number]["id"];
export type EffectId = (typeof PROFILE_EFFECTS)[number]["id"];

const BANNER_IDS = new Set<string>(PROFILE_BANNERS.map((item) => item.id));
const EFFECT_IDS = new Set<string>(PROFILE_EFFECTS.map((item) => item.id));

export const isBannerId = (value: unknown): value is BannerId => typeof value === "string" && BANNER_IDS.has(value);
export const isEffectId = (value: unknown): value is EffectId => typeof value === "string" && EFFECT_IDS.has(value);

type Unlockable = { id: string; unlock?: string };

/** Livre, ou o nível de conquista que destrava já foi alcançado. */
export function isUnlocked(item: Unlockable, unlockedLevelIds: ReadonlySet<string>) {
  return !item.unlock || unlockedLevelIds.has(item.unlock);
}

const NAMES: Record<string, string> = {
  presenca: "Presença",
  sequencia: "Sequência",
  vitorias: "Vitórias",
  destaque: "Destaque",
  torneios: "Torneios",
  colecao: "Colecionador",
  maestro: "Maestro",
};
const TIERS: Record<string, string> = { bronze: "Bronze", silver: "Prata", gold: "Ouro", legend: "Lendário" };

/** "presenca-silver" → "Presença · Prata" (texto do cadeado). */
export function unlockLabel(levelId: string) {
  const [track, tier] = levelId.split("-");
  return `${NAMES[track] ?? track} · ${TIERS[tier] ?? tier}`;
}

export function cosmeticName(kind: CosmeticKind, id: string, frames: readonly { id: string; name: string }[]) {
  const list = kind === "banner" ? PROFILE_BANNERS : kind === "effect" ? PROFILE_EFFECTS : frames;
  return list.find((item) => item.id === id)?.name ?? id;
}
