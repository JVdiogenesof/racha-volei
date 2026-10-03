export const MUSIC_TEAM_NAMES = ["Cobertor", "Mágica", "Ficha Limpa", "Refém"] as const;

export function assignTeamNames(teamCount: number, random: () => number = Math.random): string[] {
  const names = [...MUSIC_TEAM_NAMES];

  for (let index = names.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [names[index], names[swapIndex]] = [names[swapIndex], names[index]];
  }

  return Array.from({ length: teamCount }, (_, index) => names[index] ?? `Time ${index + 1}`);
}

export function teamDisplayName(team: { name?: string | null; teamNumber: number }) {
  return team.name?.trim() || `Time ${team.teamNumber}`;
}
