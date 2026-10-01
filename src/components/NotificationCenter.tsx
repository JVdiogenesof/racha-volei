import { NotificationBell } from "./NotificationBell";
import type { AppChromeData } from "@/lib/appChromeData";

type NotifProfile = { id: string; is_organizer: boolean; status: string; communities: string[] };

export async function NotificationCenter({ profile, chromeData }: { profile: NotifProfile; chromeData: Promise<AppChromeData> }) {
  if (profile.status !== "approved") return null;
  const { notifications } = await chromeData;
  return <NotificationBell items={notifications} />;
}
