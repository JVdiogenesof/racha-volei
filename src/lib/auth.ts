import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { readProfileFromHeaders } from "@/lib/supabase/profile-header";
import { PROFILE_COLUMNS } from "@/lib/supabase/session-headers";

export type OrganizerScope = "full" | "lists" | "lists_arts";
/** lists = listas/times/confrontos; arts = geração de artes; admin = notas, ranking, reserva, finanças etc. */
export type OrganizerArea = "lists" | "arts" | "admin";

export function organizerCan(profile: { is_organizer: boolean; organizer_scope?: OrganizerScope | null }, area: OrganizerArea) {
  if (!profile.is_organizer) return false;
  const scope = profile.organizer_scope ?? "full";
  if (scope === "full") return true;
  if (area === "lists") return true;
  if (area === "arts") return scope === "lists_arts";
  return false;
}

export interface CurrentProfile {
  id: string;
  full_name: string;
  birthdate: string | null;
  phone: string | null;
  avatar_url: string | null;
  avatar_frame: string | null;
  nickname_badge: string | null;
  is_setter: boolean;
  attendance_frequency: "weekly" | "biweekly" | "monthly" | null;
  has_vpa_shirt: boolean;
  wants_tournaments: boolean;
  player_level: "beginner" | "intermediate" | "advanced" | null;
  communities: string[];
  is_organizer: boolean;
  organizer_scope: OrganizerScope;
  status: "pending" | "approved" | "rejected" | "removed" | "guest" | "visitor" | "suspended";
  guest_for_event_id: string | null;
  /** Versão do regulamento aceita (ver RULES_VERSION). */
  rules_accepted_version: string | null;
}

export async function requireMember(): Promise<CurrentProfile> {
  const profile = await requireProfile();
  if (profile.status !== "approved") {
    throw new Error("Essa ação é liberada para membros do VPA.");
  }
  return profile;
}

export async function requireEventParticipant(eventId: string): Promise<CurrentProfile> {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { data: event } = await supabase.from("events").select("community").eq("id", eventId).maybeSingle();
  const canParticipate =
    (profile.status === "approved" && event !== null && profile.communities.includes(event.community)) ||
    (profile.status === "guest" && profile.guest_for_event_id === eventId);
  if (!canParticipate) {
    throw new Error("Você não tem acesso para participar desse racha.");
  }
  return profile;
}

export async function requireProfile(): Promise<CurrentProfile> {
  const cached = await readProfileFromHeaders<CurrentProfile>();
  if (cached) return cached.profile;

  // Fallback: só acontece se essa requisição não passou pelo middleware
  // (ex: chamada fora do matcher do proxy.ts).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) redirect("/cadastro");

  return profile as CurrentProfile;
}

export async function requireOrganizer(area: OrganizerArea = "lists"): Promise<CurrentProfile> {
  const profile = await requireProfile();
  if (!organizerCan(profile, area)) redirect("/");
  return profile;
}
