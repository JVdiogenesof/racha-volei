export interface PlayerInput {
  profileId: string;
  overall: number;
  settingScore: number;
  isSetter: boolean;
}

export interface TeamResult {
  teamNumber: number;
  memberProfileIds: string[];
  setterProfileId: string | null;
}

interface TeamAccumulator {
  sum: number;
  members: string[];
  setterId: string | null;
}

interface TeamCandidate {
  teams: TeamResult[];
  quality: number;
}

/**
 * Separa o time fixo do sorteio: balanceia só o resto dos jogadores nos
 * times restantes (numTeams - 1) e devolve o time fixo pronto como time 1.
 */
function balanceTeamsWithFixedTeam(
  players: PlayerInput[],
  numTeams: number,
  maxPlayersPerTeam: number | undefined,
  random: () => number,
  fixedTeamProfileIds: string[],
): TeamResult[] {
  const fixedIdSet = new Set(fixedTeamProfileIds);
  const fixedMembers = players.filter((player) => fixedIdSet.has(player.profileId));
  const missing = fixedTeamProfileIds.filter((id) => !players.some((player) => player.profileId === id));
  if (missing.length) {
    throw new Error("Algum jogador do time fixo não está na lista de confirmados.");
  }
  if (numTeams < 2) {
    throw new Error("Precisa de pelo menos 2 times pra reservar um time fixo.");
  }
  if (maxPlayersPerTeam != null && fixedMembers.length > maxPlayersPerTeam) {
    throw new Error(`O time fixo tem mais gente do que cabe num time (${maxPlayersPerTeam}).`);
  }

  const settingScoreById = new Map(players.map((player) => [player.profileId, player.settingScore]));
  const fixedSetter = fixedMembers.find((player) => player.isSetter)?.profileId
    ?? highestSettingMember(fixedMembers.map((p) => p.profileId), settingScoreById);
  const fixedTeam: TeamResult = {
    teamNumber: 1,
    memberProfileIds: fixedMembers.map((player) => player.profileId),
    setterProfileId: fixedSetter,
  };

  const rest = players.filter((player) => !fixedIdSet.has(player.profileId));
  const restTeams = balanceTeams(rest, numTeams - 1, maxPlayersPerTeam, random);

  return [fixedTeam, ...restTeams.map((team) => ({ ...team, teamNumber: team.teamNumber + 1 }))];
}

/**
 * Monta várias escalações equilibradas e escolhe aleatoriamente entre as
 * melhores. Antes, os empates eram resolvidos pelo profileId, o que deixava a
 * formação praticamente igual toda vez. Agora a aleatoriedade aparece tanto
 * na distribuição quanto na escolha da escalação final, sem aceitar times
 * nitidamente desequilibrados.
 *
 * `fixedTeamProfileIds`, quando informado, tira esse grupo do sorteio e
 * entrega ele pronto como o time 1 -- o resto dos jogadores é balanceado
 * normalmente nos times restantes. Serve pra manter um time que já jogou
 * junto (ex: o campeão do racha passado) pro próximo racha.
 */
export function balanceTeams(
  players: PlayerInput[],
  numTeams: number,
  maxPlayersPerTeam?: number,
  random: () => number = Math.random,
  fixedTeamProfileIds?: string[],
): TeamResult[] {
  if (numTeams < 1) {
    throw new Error("numTeams deve ser maior ou igual a 1");
  }
  if (maxPlayersPerTeam != null && players.length > numTeams * maxPlayersPerTeam) {
    throw new Error("Há mais jogadores do que vagas disponíveis nos times.");
  }

  if (fixedTeamProfileIds?.length) {
    return balanceTeamsWithFixedTeam(players, numTeams, maxPlayersPerTeam, random, fixedTeamProfileIds);
  }

  if (!players.length) {
    return Array.from({ length: numTeams }, (_, index) => ({
      teamNumber: index + 1,
      memberProfileIds: [],
      setterProfileId: null,
    }));
  }

  const attempts = Math.min(96, Math.max(32, players.length * 5));
  const candidates = new Map<string, TeamCandidate>();

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const teams = buildBalancedCandidate(players, numTeams, maxPlayersPerTeam, random);
    const signature = compositionSignature(teams);
    const candidate = { teams, quality: candidateQuality(teams, players, numTeams) };
    const current = candidates.get(signature);
    if (!current || candidate.quality < current.quality) candidates.set(signature, candidate);
  }

  const ranked = [...candidates.values()].sort((a, b) => a.quality - b.quality);
  const best = ranked[0];
  if (!best) throw new Error("Não foi possível montar os times.");

  const averageOverall = players.reduce((sum, player) => sum + player.overall, 0) / players.length;
  // Aceita somente alternativas visualmente tão equilibradas quanto a melhor.
  // Essa faixa dá liberdade para misturar jogadores sem sacrificar o racha.
  const qualityWindow = Math.max(0.45, averageOverall * 0.12);
  const balancedPool = ranked
    .filter((candidate) => candidate.quality <= best.quality + qualityWindow)
    .slice(0, 24);

  return balancedPool[Math.floor(random() * balancedPool.length)]?.teams ?? best.teams;
}

function buildBalancedCandidate(
  players: PlayerInput[],
  numTeams: number,
  maxPlayersPerTeam: number | undefined,
  random: () => number,
): TeamResult[] {
  const teams: TeamAccumulator[] = Array.from({ length: numTeams }, () => ({
    sum: 0,
    members: [],
    setterId: null,
  }));
  const averageOverall = players.reduce((sum, player) => sum + player.overall, 0) / players.length;
  const selectionSlack = Math.max(0.35, averageOverall * 0.08);

  const chooseTeam = (): number => {
    const available = teams
      .map((team, index) => ({ team, index }))
      .filter(({ team }) => maxPlayersPerTeam == null || team.members.length < maxPlayersPerTeam);
    if (!available.length) throw new Error("Todos os times já atingiram o limite de jogadores.");

    const minimumSum = Math.min(...available.map(({ team }) => team.sum));
    const closestTeams = available.filter(({ team }) => team.sum <= minimumSum + selectionSlack);
    return closestTeams[Math.floor(random() * closestTeams.length)].index;
  };

  const assign = (player: PlayerInput, index: number) => {
    const team = teams[index];
    team.members.push(player.profileId);
    team.sum += player.overall;
    if (player.isSetter && team.setterId === null) team.setterId = player.profileId;
  };

  const setters = stableRandomSort(players.filter((player) => player.isSetter), "settingScore", random);
  const rest = stableRandomSort(players.filter((player) => !player.isSetter), "overall", random);

  for (const setter of setters) assign(setter, chooseTeam());
  for (const player of rest) assign(player, chooseTeam());

  const settingScoreById = new Map(players.map((player) => [player.profileId, player.settingScore]));
  return teams.map((team, index) => ({
    teamNumber: index + 1,
    memberProfileIds: team.members,
    setterProfileId: team.setterId ?? highestSettingMember(team.members, settingScoreById),
  }));
}

function stableRandomSort<T extends PlayerInput>(
  players: T[],
  key: "overall" | "settingScore",
  random: () => number,
): T[] {
  return players
    .map((player) => ({ player, randomOrder: random() }))
    .sort((a, b) => b.player[key] - a.player[key] || a.randomOrder - b.randomOrder)
    .map(({ player }) => player);
}

function candidateQuality(teams: TeamResult[], players: PlayerInput[], numTeams: number): number {
  const playerById = new Map(players.map((player) => [player.profileId, player]));
  const sums = teams.map((team) => team.memberProfileIds.reduce((sum, id) => sum + (playerById.get(id)?.overall ?? 0), 0));
  const averageOverall = players.reduce((sum, player) => sum + player.overall, 0) / players.length;
  const missingSetters = players.filter((player) => player.isSetter).length >= numTeams
    ? teams.filter((team) => !team.memberProfileIds.some((id) => playerById.get(id)?.isSetter)).length
    : 0;

  return Math.max(...sums) - Math.min(...sums) + missingSetters * averageOverall * 4;
}

function highestSettingMember(memberIds: string[], settingScoreById: Map<string, number>): string | null {
  return memberIds.reduce<string | null>((bestId, memberId) => {
    if (!bestId) return memberId;
    return (settingScoreById.get(memberId) ?? 0) > (settingScoreById.get(bestId) ?? 0) ? memberId : bestId;
  }, null);
}

// Ignora o número/nome do time: trocar "Time 1" com "Time 2" não conta como
// uma nova formação, porque os jogadores continuariam nas mesmas equipes.
function compositionSignature(teams: TeamResult[]): string {
  return teams
    .map((team) => [...team.memberProfileIds].sort().join(","))
    .sort()
    .join("|");
}
