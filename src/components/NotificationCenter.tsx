import { createClient } from "@/lib/supabase/server";
import { readProfileFromHeaders } from "@/lib/supabase/profile-header";
import { PROFILE_COLUMNS } from "@/lib/supabase/session-headers";
import { getNotifications } from "@/lib/notifications";
import { NotificationBell } from "./NotificationBell";

type NotifProfile = { id: string; is_organizer: boolean; status: string };

export async function NotificationCenter() {
  const supabase = await createClient();
  const cached = await readProfileFromHeaders<NotifProfile>();

  let profile: NotifProfile | null;
  if (cached) {
    profile = cached.profile;
  } else {
    // Fallback: só acontece se essa requisição não passou pelo middleware.
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase.from("profiles").select(PROFILE_COLUMNS).eq("id", user.id).maybeSingle();
    profile = data;
  }

  if (!profile || profile.status !== "approved") return null;

  const items = await getNotifications(supabase, profile);

  return <NotificationBell items={items} />;
}
