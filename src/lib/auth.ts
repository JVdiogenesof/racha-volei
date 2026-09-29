import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { readProfileFromHeaders } from "@/lib/supabase/profile-header";
import { PROFILE_COLUMNS } from "@/lib/supabase/session-headers";

export interface CurrentProfile {
  id: string;
  full_name: string;
  birthdate: string | null;
  phone: string | null;
  avatar_url: string | null;
  nickname_badge: string | null;
  is_setter: boolean;
  attendance_frequency: "weekly" | "biweekly" | "monthly" | null;
  has_vpa_shirt: boolean;
  wants_tournaments: boolean;
  player_level: "beginner" | "intermediate" | "advanced" | null;
  is_organizer: boolean;
  status: "pending" | "approved" | "rejected" | "removed" | "guest" | "visitor";
  guest_for_event_id: string | null;
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
  const canParticipate =
    profile.status === "approved" ||
    (profile.status === "guest" && profile.guest_for_event_id === eventId);
  if (!canParticipate) {
    throw new Error("Você está no modo visitante. Um organizador precisa chamar você para este racha.");
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

export async function requireOrganizer(): Promise<CurrentProfile> {
  const profile = await requireProfile();
  if (!profile.is_organizer) redirect("/");
  return profile;
}
