// Pré-lançamento: liberar somente JV e Vidal, pelos IDs das contas.
// Na abertura pública, revisar também a policy shirt_orders_preview_access.
const SHIRT_PREVIEW_IDS = new Set([
  "ea6c4b3a-a774-4ccd-a705-c14220193812",
  "8048d01b-6fca-4b92-afb4-22677d392d47",
]);

export function canAccessShirts(profileId: string | undefined): boolean {
  return !!profileId && SHIRT_PREVIEW_IDS.has(profileId);
}
