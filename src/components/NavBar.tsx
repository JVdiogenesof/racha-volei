import { signOut } from "@/app/(app)/actions";
import { BottomTabBar, DesktopNav } from "@/components/AppNavigation";
import { CompactAppHeader } from "@/components/CompactAppHeader";
import { HeaderTopBar } from "@/components/HeaderTopBar";
import { NotificationBell } from "@/components/NotificationBell";
import type { AppChromeData } from "@/lib/appChromeData";
import { createClient } from "@/lib/supabase/server";
import { getHeaderLook } from "@/lib/profileCosmetics";

type NavProfile = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  avatar_frame: string | null;
  nickname_badge: string | null;
  is_organizer: boolean;
  status: string;
  guest_for_event_id: string | null;
  communities: string[] | null;
};

export async function NavBar({
  profile,
  chromeData,
}: {
  profile: NavProfile;
  chromeData: Promise<AppChromeData>;
}) {
  const supabase = await createClient();
  const [{ newAvisosCount, upcomingEvents, attendanceByEvent, notifications }, look] = await Promise.all([
    chromeData,
    profile.status === "approved" ? getHeaderLook(supabase, profile.id).catch(() => ({ banner: null, medals: [] })) : Promise.resolve({ banner: null, medals: [] }),
  ]);

  const respondedIds = new Set(attendanceByEvent.keys());
  const pendingConfirmCount = profile.status === "approved" ? (upcomingEvents ?? []).filter((event) => !respondedIds.has(event.id)).length : 0;
  const nearest = upcomingEvents?.[0];
  const attendanceStatus = nearest ? (attendanceByEvent.get(nearest.id) ?? null) : null;

  const badgeByHref: Record<string, number> = {
    "/avisos": newAvisosCount,
    "/racha": pendingConfirmCount,
  };

  return (
    <>
      <CompactAppHeader
        topBar={
          <HeaderTopBar
            fullName={profile.full_name}
            avatarUrl={profile.avatar_url}
            avatarFrame={profile.avatar_frame}
            nickname={profile.nickname_badge}
            medals={look.medals}
            banner={look.banner}
            isOrganizer={profile.is_organizer}
            isVisitor={profile.status !== "approved"}
            attendanceStatus={attendanceStatus}
            signOutAction={signOut}
            navigation={<DesktopNav badgeByHref={badgeByHref} isOrganizer={profile.is_organizer} />}
            bell={profile.status === "approved" ? <NotificationBell items={notifications} /> : null}
          />
        }
      />
      <BottomTabBar badgeByHref={badgeByHref} isOrganizer={profile.is_organizer} />
    </>
  );
}
