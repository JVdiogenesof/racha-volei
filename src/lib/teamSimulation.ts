import type { PlayerInput, TeamResult } from "./balanceTeams";

export function teamCompositionSignature(teams: TeamResult[]): string {
  return [...teams]
    .sort((a, b) => a.teamNumber - b.teamNumber)
    .map((team) => [...team.memberProfileIds].sort().join(","))
    .join("|");
}

/**
 * Cria uma variação da geração equilibrada trocando jogadores de perfil
 * equivalente entre dois times. Levantador só troca com levantador e os
 * candidatos com menor diferença entre as somas dos times têm prioridade.
 * A assinatura anterior é excluída para que dois cliques seguidos não
 * devolvam exatamente a mesma composição quando existe outra possibilidade.
 */
export function varySimulatedTeams(
  baseTeams: TeamResult[],
  players: PlayerInput[],
  previousSignature?: string,
): TeamResult[] {
  const playerById = new Map(players.map((player) => [player.profileId, player]));
  const candidates = new Map<string, { teams: TeamResult[]; spread: number }>();

  for (let teamAIndex = 0; teamAIndex < baseTeams.length; teamAIndex++) {
    for (let teamBIndex = teamAIndex + 1; teamBIndex < baseTeams.length; teamBIndex++) {
      const teamA = baseTeams[teamAIndex];
      const teamB = baseTeams[teamBIndex];

      for (const playerAId of teamA.memberProfileIds) {
        for (const playerBId of teamB.memberProfileIds) {
          const playerA = playerById.get(playerAId);
          const playerB = playerById.get(playerBId);
          if (!playerA || !playerB || playerA.isSetter !== playerB.isSetter) continue;

          const varied = baseTeams.map((team) => ({ ...team, memberProfileIds: [...team.memberProfileIds] }));
          const variedA = varied[teamAIndex];
          const variedB = varied[teamBIndex];
          variedA.memberProfileIds[variedA.memberProfileIds.indexOf(playerAId)] = playerBId;
          variedB.memberProfileIds[variedB.memberProfileIds.indexOf(playerBId)] = playerAId;

          for (const team of [variedA, variedB]) {
            const setters = team.memberProfileIds
              .map((id) => playerById.get(id))
              .filter((player): player is PlayerInput => Boolean(player?.isSetter))
              .sort((a, b) => b.settingScore - a.settingScore);
            team.setterProfileId = setters[0]?.profileId ?? highestSettingMember(team.memberProfileIds, playerById);
          }

          const signature = teamCompositionSignature(varied);
          if (signature === previousSignature || candidates.has(signature)) continue;
          const sums = varied.map((team) =>
            team.memberProfileIds.reduce((sum, id) => sum + (playerById.get(id)?.overall ?? 0), 0),
          );
          candidates.set(signature, { teams: varied, spread: Math.max(...sums) - Math.min(...sums) });
        }
      }
    }
  }

  const ranked = [...candidates.values()].sort((a, b) => a.spread - b.spread);
  if (ranked.length) {
    // Sorteia entre as melhores alternativas para variar sem sacrificar o
    // equilíbrio. Com 4 times de 6 jogadores há muitas opções diferentes.
    const balancedPool = ranked.slice(0, Math.min(16, ranked.length));
    return balancedPool[Math.floor(Math.random() * balancedPool.length)].teams;
  }

  // Em grupos pequenos demais para uma troca equivalente, alterna com a
  // composição-base se ela ainda for diferente do resultado anterior.
  return baseTeams;
}

function highestSettingMember(memberIds: string[], playerById: Map<string, PlayerInput>): string | null {
  return memberIds.reduce<string | null>((bestId, memberId) => {
    if (!bestId) return memberId;
    const bestScore = playerById.get(bestId)?.settingScore ?? 0;
    const score = playerById.get(memberId)?.settingScore ?? 0;
    return score > bestScore ? memberId : bestId;
  }, null);
}
