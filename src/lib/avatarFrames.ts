/**
 * Molduras de foto de perfil. O desenho de cada uma fica em
 * components/AvatarFrameArt.tsx; aqui só o catálogo (id gravado no banco,
 * nome e uma frase pra tela de escolha).
 */
export const AVATAR_FRAMES = [
  { id: "coelhinho", name: "Coelhinho Fofo", tagline: "Orelhinhas pra fofura máxima" },
  { id: "gatinho", name: "Gatinho Manhoso", tagline: "Bigodes, orelhas e uma patinha" },
  { id: "ursinho", name: "Ursinho Dorminhoco", tagline: "Quentinho e redondinho" },
  { id: "margaridas", name: "Jardim da Vó", tagline: "Margaridas em volta da foto" },
  { id: "sakura", name: "Sakura", tagline: "Pétalas de cerejeira ao vento" },
  { id: "magica", name: "Estrelinha Mágica", tagline: "Brilho de heroína de anime", unlock: "destaque-silver" },
  { id: "aura", name: "Aura de Herói", tagline: "Energia no máximo, power-up!", unlock: "presenca-legend" },
  { id: "trovao", name: "Trovão", tagline: "Pra quem chega eletrizando", unlock: "vitorias-bronze" },
  { id: "coroa", name: "Majestade", tagline: "Quem manda na quadra", unlock: "vitorias-legend" },
  { id: "cortada", name: "Cortada no Talo", tagline: "A bola passa voando em volta", unlock: "vitorias-silver" },
  { id: "bola", name: "Bola Oficial", tagline: "Gomos azuis, amarelos e brancos" },
  { id: "rede", name: "Rede Armada", tagline: "Trançado de rede e bola no canto" },
  { id: "verao", name: "Verão no Areião", tagline: "Sol, areia e ondinhas" },
  { id: "mare", name: "Maré Alta", tagline: "Espuma e bolhas subindo" },
  { id: "pixel", name: "Três Vidas", tagline: "Retrô de fliperama, 8 bits" },
  { id: "amor", name: "Vôlei por Amor", tagline: "Corações roxos do VPA" },
  { id: "noite", name: "Noite Estrelada", tagline: "Lua, estrelas e céu fundo" },
  { id: "grafite", name: "Rolê de Rua", tagline: "Spray, tinta e personalidade", unlock: "sequencia-silver" },
  { id: "neon", name: "Neon Noturno", tagline: "Brilha no escuro", unlock: "sequencia-legend" },
  // Inspiradas em animes, desenhos e filmes (desenhos nossos, sem personagens de ninguém).
  { id: "ninja", name: "Espiral Ninja", tagline: "Chakra girando em redemoinho" },
  { id: "furia", name: "Fúria Dourada", tagline: "Cabelo pro alto e energia no talo" },
  { id: "sabres", name: "Duelo de Sabres", tagline: "Dois sabres de luz cruzados" },
  { id: "codigo", name: "Código Verde", tagline: "Chuva de código na tela" },
  { id: "pirata", name: "Tesouro do Pirata", tagline: "Corda, moedas e chapéu de capitão" },
  { id: "portal", name: "Portal de Faíscas", tagline: "Círculo mágico em brasa" },
  { id: "gelo", name: "Rainha do Gelo", tagline: "Cristais e flocos congelados" },
  { id: "esferas", name: "Esferas Místicas", tagline: "Sete orbes em órbita" },
  { id: "floresta", name: "Floresta Encantada", tagline: "Folhas e luzinhas da mata" },
  { id: "noturno", name: "Senhor da Noite", tagline: "Morcegos e lua cheia" },
  { id: "blocos", name: "Mundo de Blocos", tagline: "Cubinhos de construir" },
  { id: "hiperespaco", name: "Salto no Hiperespaço", tagline: "Estrelas em velocidade de dobra" },
  { id: "chama", name: "Chama Azul", tagline: "Fogo que só impressiona" },
] as const satisfies readonly { id: string; name: string; tagline: string; unlock?: string }[];

export type AvatarFrameId = (typeof AVATAR_FRAMES)[number]["id"];

const FRAME_IDS = new Set<string>(AVATAR_FRAMES.map((frame) => frame.id));

export function isAvatarFrameId(value: unknown): value is AvatarFrameId {
  return typeof value === "string" && FRAME_IDS.has(value);
}
