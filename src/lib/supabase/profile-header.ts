import { headers } from "next/headers";
import { PROFILE_HEADER, USER_ID_HEADER } from "./session-headers";

/**
 * Lê o perfil que o middleware já carregou pra essa requisição (ver
 * updateSession em ./middleware.ts). Retorna null se o header não vier —
 * caso em que quem chamou deve cair de volta pra uma consulta direta ao
 * Supabase (ex: chamada fora do alcance do middleware).
 */
export async function readProfileFromHeaders<T>(): Promise<{ userId: string; profile: T } | null> {
  const h = await headers();
  const userId = h.get(USER_ID_HEADER);
  const rawProfile = h.get(PROFILE_HEADER);
  if (!userId || !rawProfile) return null;

  try {
    return { userId, profile: JSON.parse(decodeURIComponent(rawProfile)) as T };
  } catch {
    return null;
  }
}
