export type EventGameStyle = "casual" | "mini_tournament" | "pre_tournament";

export function eventGameStyleFromFlags(isPreTournament: boolean, isMiniTournament: boolean): EventGameStyle {
  if (isPreTournament) return "pre_tournament";
  if (isMiniTournament) return "mini_tournament";
  return "casual";
}

export function isTournamentStyle(isPreTournament: boolean, isMiniTournament: boolean) {
  return isPreTournament || isMiniTournament;
}
