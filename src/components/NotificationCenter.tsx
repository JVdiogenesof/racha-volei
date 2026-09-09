import { createClient } from "@/lib/supabase/server";
import { getNotifications } from "@/lib/notifications";
import { NotificationBell } from "./NotificationBell";

export async function NotificationCenter() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, is_organizer, status")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.status !== "approved") return null;

  const items = await getNotifications(supabase, profile);

  return <NotificationBell items={items} />;
}
