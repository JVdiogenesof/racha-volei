// Notas dos jogadores só podem ser vistas por JV e Vidal.
const NOTE_VIEWER_IDS = new Set([
  "ea6c4b3a-a774-4ccd-a705-c14220193812", // JV
  "8048d01b-6fca-4b92-afb4-22677d392d47", // Vidal
]);

export function canSeePlayerNotes(profile: { id: string }): boolean {
  return NOTE_VIEWER_IDS.has(profile.id);
}
