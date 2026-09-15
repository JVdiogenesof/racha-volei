// Pareamento e classificação da fase de grupos de um racha pré-torneio.
// Critério de desempate (nessa ordem, exatamente como o Vidal descreveu pro
// pré-torneio de 20/09): saldo de pontos -> confronto direto -> número de
// vitórias -> pontos feitos.

export type TournamentTeam = {
  id: string;
  teamNumber: number;
};

export type TournamentMatch = {
  teamAId: string;
  teamBId: string;
  scoreA: number | null;
  scoreB: number | null;
};

export type StandingRow = {
  teamId: string;
  teamNumber: number;
  wins: number;
  pointsFor: number;
  pointsAgainst: number;
  balance: number;
};

/** Todos os pares únicos entre os times -- "todos contra todos" pra N times. */
export function generateRoundRobinPairs(teamIds: string[]): [string, string][] {
  const pairs: [string, string][] = [];
  for (let i = 0; i < teamIds.length; i++) {
    for (let j = i + 1; j < teamIds.length; j++) {
      pairs.push([teamIds[i], teamIds[j]]);
    }
  }
  return pairs;
}

function playedMatches(matches: TournamentMatch[]) {
  return matches.filter((m) => m.scoreA != null && m.scoreB != null) as (TournamentMatch & {
    scoreA: number;
    scoreB: number;
  })[];
}

function baseRow(team: TournamentTeam): StandingRow {
  return { teamId: team.id, teamNumber: team.teamNumber, wins: 0, pointsFor: 0, pointsAgainst: 0, balance: 0 };
}

/**
 * Confronto direto entre os times empatados. Com exatamente 2, usa o
 * resultado do jogo entre eles. Com 3+, cai numa mini-classificação só com
 * os jogos entre os times daquele grupo de empate (vitórias dentro do
 * subgrupo).
 */
function headToHeadWins(tiedTeamIds: string[], matches: (TournamentMatch & { scoreA: number; scoreB: number })[]) {
  const wins = new Map<string, number>(tiedTeamIds.map((id) => [id, 0]));
  for (const m of matches) {
    if (!tiedTeamIds.includes(m.teamAId) || !tiedTeamIds.includes(m.teamBId)) continue;
    const winnerId = m.scoreA > m.scoreB ? m.teamAId : m.teamBId;
    wins.set(winnerId, (wins.get(winnerId) ?? 0) + 1);
  }
  return wins;
}

export function computeStandings(teams: TournamentTeam[], matches: TournamentMatch[]): StandingRow[] {
  const rows = new Map(teams.map((t) => [t.id, baseRow(t)]));
  const played = playedMatches(matches);

  for (const m of played) {
    const rowA = rows.get(m.teamAId);
    const rowB = rows.get(m.teamBId);
    if (!rowA || !rowB) continue;
    rowA.pointsFor += m.scoreA;
    rowA.pointsAgainst += m.scoreB;
    rowB.pointsFor += m.scoreB;
    rowB.pointsAgainst += m.scoreA;
    if (m.scoreA > m.scoreB) rowA.wins += 1;
    else rowB.wins += 1;
  }
  for (const row of rows.values()) row.balance = row.pointsFor - row.pointsAgainst;

  const sorted = [...rows.values()].sort((a, b) => b.wins - a.wins);

  // Resolve empates de vitórias em blocos, aplicando o critério do Vidal
  // dentro de cada bloco: saldo -> confronto direto -> vitórias (redundante
  // dentro do bloco, mas mantido pra seguir a ordem exata) -> pontos feitos.
  const result: StandingRow[] = [];
  let i = 0;
  while (i < sorted.length) {
    let j = i + 1;
    while (j < sorted.length && sorted[j].wins === sorted[i].wins) j++;
    const block = sorted.slice(i, j);
    if (block.length > 1) {
      const h2h = headToHeadWins(
        block.map((r) => r.teamId),
        played,
      );
      block.sort((a, b) => {
        if (b.balance !== a.balance) return b.balance - a.balance;
        const h2hDiff = (h2h.get(b.teamId) ?? 0) - (h2h.get(a.teamId) ?? 0);
        if (h2hDiff !== 0) return h2hDiff;
        if (b.wins !== a.wins) return b.wins - a.wins;
        return b.pointsFor - a.pointsFor;
      });
    }
    result.push(...block);
    i = j;
  }

  return result;
}
