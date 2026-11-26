/**
 * Regras puras do dia da Copa VPA: identidade dos times, sorteio em potes
 * equilibrado, tabela de jogos e classificação. Sem acesso a banco, para
 * poder ser testado isoladamente.
 */

export type CopaTeamIdentity = {
  slug: string;
  name: string;
  /** Cor principal e cor de destaque (hex). */
  color: string;
  accent: string;
  /** Verso do brasão: tom escuro do degradê. */
  dark: string;
};

// Os mesmos quatro times dos rachas normais (logos em public/times, ver teamLogos.ts).
export const COPA_TEAMS: CopaTeamIdentity[] = [
  { slug: "magica", name: "Mágica", color: "#a855f7", accent: "#e9d5ff", dark: "#3b1a8f" },
  { slug: "refem", name: "Refém", color: "#ef4a2f", accent: "#fecaca", dark: "#7f1020" },
  { slug: "ficha-limpa", name: "Ficha Limpa", color: "#22a05a", accent: "#fde68a", dark: "#064e3b" },
  { slug: "cobertor", name: "Cobertor", color: "#3b82f6", accent: "#bfdbfe", dark: "#1e3a8a" },
];

export function teamIdentity(slug: string): CopaTeamIdentity {
  return COPA_TEAMS.find((team) => team.slug === slug) ?? COPA_TEAMS[0];
}

export type DrawPlayer = { profileId: string; isSetter: boolean; strength: number };
export type DrawPick = { profileId: string; teamIndex: number; pot: number; pickOrder: number };

/** Embaralha com um gerador injetável (testes usam um fixo). */
export function shuffled<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [copy[index], copy[other]] = [copy[other], copy[index]];
  }
  return copy;
}

/**
 * Monta o sorteio inteiro de uma vez.
 * - Pote 0: levantadores (um por time, os de maior índice quando sobram).
 * - Demais potes: jogadores por nota (a nota geral do jogador), `numTeams` por pote.
 * - Em cada pote, o mais forte vai para o time mais fraco até ali; a ordem em
 *   que os nomes aparecem para a plateia é embaralhada, então parece aleatório.
 * Retorna as escolhas na ordem em que serão reveladas.
 */
export function planDraw(
  players: DrawPlayer[],
  numTeams: number,
  teamSize: number,
  random: () => number = Math.random,
): DrawPick[] {
  if (players.length !== numTeams * teamSize) {
    throw new Error(`Para sortear são necessários ${numTeams * teamSize} jogadores confirmados (há ${players.length}).`);
  }

  const bySetter = [...players].filter((player) => player.isSetter).sort((a, b) => b.strength - a.strength);
  const setterPot = bySetter.slice(0, numTeams);
  const rest = players
    .filter((player) => !setterPot.includes(player))
    .sort((a, b) => b.strength - a.strength || a.profileId.localeCompare(b.profileId));

  const pots: DrawPlayer[][] = [];
  if (setterPot.length) pots.push(setterPot);
  // Se faltarem levantadores, o resto preenche o primeiro pote até o tamanho de um pote.
  for (let index = 0; index < rest.length; index += numTeams) pots.push(rest.slice(index, index + numTeams));

  const strengthByTeam = Array<number>(numTeams).fill(0);
  const sizeByTeam = Array<number>(numTeams).fill(0);
  const picks: DrawPick[] = [];
  let pickOrder = 1;

  pots.forEach((pot, potIndex) => {
    const strongestFirst = [...pot].sort((a, b) => b.strength - a.strength);
    const assignment = new Map<string, number>();
    const taken = new Set<number>();
    for (const player of strongestFirst) {
      const open = Array.from({ length: numTeams }, (_, team) => team).filter((team) => sizeByTeam[team] < teamSize);
      // Um time por jogador dentro do pote; só repete se não houver outra vaga aberta.
      const candidates = open.filter((team) => !taken.has(team)).length ? open.filter((team) => !taken.has(team)) : open;
      const weakest = candidates.sort(
        (a, b) => strengthByTeam[a] - strengthByTeam[b] || sizeByTeam[a] - sizeByTeam[b] || random() - 0.5,
      )[0];
      taken.add(weakest);
      assignment.set(player.profileId, weakest);
      strengthByTeam[weakest] += player.strength;
      sizeByTeam[weakest] += 1;
    }
    for (const player of shuffled(pot, random)) {
      picks.push({ profileId: player.profileId, teamIndex: assignment.get(player.profileId)!, pot: setterPot.length ? potIndex : potIndex + 1, pickOrder });
      pickOrder += 1;
    }
  });
  return picks;
}

export type Fixture = { stage: "group"; round: number; slot: number; teamA: number; teamB: number };

/** Todos contra todos pelo método do círculo: cada time joga uma vez por rodada. */
export function roundRobin(numTeams: number): Fixture[] {
  const ids = Array.from({ length: numTeams }, (_, index) => index);
  if (ids.length % 2) ids.push(-1);
  const half = ids.length / 2;
  const fixtures: Fixture[] = [];
  let slot = 1;
  let ring = [...ids];
  for (let round = 1; round < ids.length; round += 1) {
    for (let index = 0; index < half; index += 1) {
      const a = ring[index];
      const b = ring[ring.length - 1 - index];
      if (a === -1 || b === -1) continue;
      fixtures.push({ stage: "group", round, slot, teamA: a, teamB: b });
      slot += 1;
    }
    ring = [ring[0], ring[ring.length - 1], ...ring.slice(1, -1)];
  }
  return fixtures;
}

export type MatchResult = { teamA: string; teamB: string; scoreA: number | null; scoreB: number | null };
export type Standing = { teamId: string; played: number; wins: number; losses: number; pointsFor: number; pointsAgainst: number; balance: number };

/** Classificação: vitórias, saldo de pontos, pontos pró, depois confronto direto. */
export function computeStandings(teamIds: string[], matches: MatchResult[]): Standing[] {
  const table = new Map<string, Standing>(
    teamIds.map((teamId) => [teamId, { teamId, played: 0, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, balance: 0 }]),
  );
  for (const match of matches) {
    if (match.scoreA == null || match.scoreB == null) continue;
    const a = table.get(match.teamA);
    const b = table.get(match.teamB);
    if (!a || !b) continue;
    a.played += 1;
    b.played += 1;
    a.pointsFor += match.scoreA;
    a.pointsAgainst += match.scoreB;
    b.pointsFor += match.scoreB;
    b.pointsAgainst += match.scoreA;
    if (match.scoreA > match.scoreB) {
      a.wins += 1;
      b.losses += 1;
    } else if (match.scoreB > match.scoreA) {
      b.wins += 1;
      a.losses += 1;
    }
  }
  const headToHead = (x: string, y: string) => {
    const game = matches.find((m) => m.scoreA != null && m.scoreB != null && ((m.teamA === x && m.teamB === y) || (m.teamA === y && m.teamB === x)));
    if (!game) return 0;
    const xScore = game.teamA === x ? game.scoreA! : game.scoreB!;
    const yScore = game.teamA === x ? game.scoreB! : game.scoreA!;
    return yScore - xScore; // negativo: x venceu, vem antes
  };
  const rows = [...table.values()].map((row) => ({ ...row, balance: row.pointsFor - row.pointsAgainst }));
  return rows.sort(
    (a, b) => b.wins - a.wins || b.balance - a.balance || b.pointsFor - a.pointsFor || headToHead(a.teamId, b.teamId) || a.teamId.localeCompare(b.teamId),
  );
}

/** Vencedor do jogo, ou null se ainda não há placar (ou empate). */
export function matchWinner(match: { team_a_id: string; team_b_id: string; score_a: number | null; score_b: number | null }) {
  if (match.score_a == null || match.score_b == null || match.score_a === match.score_b) return null;
  return match.score_a > match.score_b ? match.team_a_id : match.team_b_id;
}

/** Horário de cada jogo: sequência a partir do início do dia, um depois do outro. */
export function scheduleAt(dateIso: string, dayStart: string, matchMinutes: number, slotIndex: number) {
  const [hours, minutes] = dayStart.slice(0, 5).split(":").map(Number);
  // Brasília é UTC-3 o ano todo (sem horário de verão desde 2019).
  const base = Date.UTC(Number(dateIso.slice(0, 4)), Number(dateIso.slice(5, 7)) - 1, Number(dateIso.slice(8, 10)), hours + 3, minutes);
  return new Date(base + slotIndex * matchMinutes * 60_000).toISOString();
}
