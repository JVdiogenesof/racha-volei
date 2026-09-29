export function teamFormatLabel(teamSize: number) {
  if (teamSize === 3) return "Trio";
  if (teamSize === 4) return "Quarteto";
  return "Sexteto";
}
