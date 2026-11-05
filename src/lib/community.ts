export type Community = "court";

export const COMMUNITY_INFO: Record<Community, { label: string; shortLabel: string }> = {
  court: { label: "Racha de Quadra", shortLabel: "Quadra" },
};

export async function getActiveCommunity(): Promise<Community> {
  return "court";
}
