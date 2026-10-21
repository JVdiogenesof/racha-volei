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
  // Organizador via as duas comunidades sempre, mesmo sem usar areia -- com o
  // racha de areia ainda sem nenhum evento, isso só deixava a aba acesa à toa
  // pra quem nunca entra lá. Agora segue a mesma regra de todo mundo: só vê
  // o que está no próprio cadastro (ajustável em Admin > Jogadores).
  const available = parseCommunities(profile?.communities);
  return (requested === "court" || requested === "sand") && available.includes(requested)
    ? requested
    : available[0];
}
