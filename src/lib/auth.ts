import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface CurrentProfile {
  id: string;
  full_name: string;
  birthdate: string | null;
  phone: string | null;
  avatar_url: string | null;
  is_setter: boolean;
  is_organizer: boolean;
  status: "pending" | "approved" | "rejected";
}

export async function requireProfile(): Promise<CurrentProfile> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, birthdate, phone, avatar_url, is_setter, is_organizer, status")
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
