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

/**
 * Monta times equilibrados: primeiro distribui os levantadores (1 por time,
 * sempre para o time com menor soma de habilidade até o momento), depois
 * distribui o restante dos jogadores do maior overall pro menor, sempre para
 * o time mais "fraco" no momento (heurística gulosa tipo LPT scheduling).
 * Se algum time ficar sem levantador (poucos setters confirmados), promove
 * o membro já alocado a esse time com maior nota de Levantamento.
 * Determinístico: empates são sempre resolvidos por profileId.
 */
export function balanceTeams(players: PlayerInput[], numTeams: number): TeamResult[] {
  if (numTeams < 1) {
    throw new Error("numTeams deve ser maior ou igual a 1");
  }

  const byId = [...players].sort((a, b) => a.profileId.localeCompare(b.profileId));

  const teams: TeamAccumulator[] = Array.from({ length: numTeams }, () => ({
    sum: 0,
    members: [],
    setterId: null,
  }));

  const leastLoadedIndex = (): number => {
    let bestIdx = 0;
    for (let i = 1; i < teams.length; i++) {
      const candidate = teams[i];
      const best = teams[bestIdx];
      if (
        candidate.sum < best.sum ||
        (candidate.sum === best.sum && candidate.members.length < best.members.length)
      ) {
        bestIdx = i;
      }
    }
    return bestIdx;
  };

  const assign = (player: PlayerInput, idx: number) => {
    teams[idx].members.push(player.profileId);
    teams[idx].sum += player.overall;
    if (player.isSetter && teams[idx].setterId === null) {
      teams[idx].setterId = player.profileId;
    }
  };

  const setters = byId
    .filter((p) => p.isSetter)
    .sort((a, b) => b.settingScore - a.settingScore || a.profileId.localeCompare(b.profileId));
  const rest = byId
    .filter((p) => !p.isSetter)
    .sort((a, b) => b.overall - a.overall || a.profileId.localeCompare(b.profileId));

  for (const setter of setters) {
    assign(setter, leastLoadedIndex());
  }
  for (const player of rest) {
    assign(player, leastLoadedIndex());
  }

  const settingScoreById = new Map(players.map((p) => [p.profileId, p.settingScore]));
  for (const team of teams) {
    if (team.setterId === null && team.members.length > 0) {
      team.setterId = team.members.reduce((bestId, memberId) => {
        const bestScore = settingScoreById.get(bestId) ?? 0;
        const score = settingScoreById.get(memberId) ?? 0;
        return score > bestScore ? memberId : bestId;
      }, team.members[0]);
    }
  }

  return teams.map((team, i) => ({
    teamNumber: i + 1,
    memberProfileIds: team.members,
    setterProfileId: team.setterId,
  }));
}
