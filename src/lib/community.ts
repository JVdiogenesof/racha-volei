import { cookies } from "next/headers";

export type Community = "court" | "sand";

export const COMMUNITY_COOKIE = "vpa-community";

export const COMMUNITY_INFO: Record<Community, { label: string; shortLabel: string }> = {
  court: { label: "Racha de Quadra", shortLabel: "Quadra" },
  sand: { label: "Racha de Areia", shortLabel: "Areia" },
};

export function parseCommunities(value?: string[] | null): Community[] {
  const valid = (value ?? []).filter((item): item is Community => item === "court" || item === "sand");
  return valid.length ? [...new Set(valid)] : ["court"];
}

export async function getActiveCommunity(profile?: { communities?: string[] | null; is_organizer?: boolean }): Promise<Community> {
  const requested = (await cookies()).get(COMMUNITY_COOKIE)?.value;
  const available = profile?.is_organizer ? (["court", "sand"] as Community[]) : parseCommunities(profile?.communities);
  return (requested === "court" || requested === "sand") && available.includes(requested)
    ? requested
    : available[0];
}
