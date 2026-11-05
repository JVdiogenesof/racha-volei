import type { ReactNode } from "react";
import { signOut } from "@/app/(app)/actions";
import { setAttendance } from "@/app/(app)/racha/[id]/confirmar/actions";
import { BottomTabBar, DesktopNav } from "@/components/AppNavigation";
import { CompactAppHeader } from "@/components/CompactAppHeader";
import { HeaderActionStrip } from "@/components/HeaderActionStrip";
import { HeaderTopBar } from "@/components/HeaderTopBar";
import { NotificationBell } from "@/components/NotificationBell";
import { parseCommunities, type Community } from "@/lib/community";
import type { AppChromeData } from "@/lib/appChromeData";
import type { HeaderAction } from "@/lib/headerAction";

type NavProfile = {
  full_name: string;
  avatar_url: string | null;
  is_organizer: boolean;
  status: string;
  guest_for_event_id: string | null;
  communities: string[] | null;
};

export async function NavBar({
  profile,
  activeCommunity,
  chromeData,
  headerAction,
}: {
  profile: NavProfile;
  activeCommunity: Community;
  chromeData: Promise<AppChromeData>;
  headerAction: Promise<HeaderAction | null>;
}) {
  const [{ newAvisosCount, upcomingEvents, attendanceByEvent, notifications }, action] = await Promise.all([chromeData, headerAction]);
  const availableCommunities = parseCommunities(profile.communities);

  const respondedIds = new Set(attendanceByEvent.keys());
  const pendingConfirmCount = profile.status === "approved" ? (upcomingEvents ?? []).filter((event) => !respondedIds.has(event.id)).length : 0;
  const nearest = upcomingEvents?.[0];
  const attendanceStatus = nearest ? (attendanceByEvent.get(nearest.id) ?? null) : null;

  const badgeByHref: Record<string, number> = {
    "/avisos": newAvisosCount,
    "/racha": pendingConfirmCount,
  };
  const strip: ReactNode = <HeaderActionStrip action={action} interestAction={setAttendance} />;

  return (
    <>
      <CompactAppHeader
        topBar={
          <HeaderTopBar
            fullName={profile.full_name}
            avatarUrl={profile.avatar_url}
            isOrganizer={profile.is_organizer}
            isVisitor={profile.status !== "approved"}
            attendanceStatus={attendanceStatus}
            activeCommunity={activeCommunity}
            availableCommunities={availableCommunities}
            signOutAction={signOut}
            navigation={<DesktopNav badgeByHref={badgeByHref} isOrganizer={profile.is_organizer} />}
            wideStrip={strip}
            bell={profile.status === "approved" ? <NotificationBell items={notifications} /> : null}
          />
        }
        strip={strip}
      />
      <BottomTabBar badgeByHref={badgeByHref} isOrganizer={profile.is_organizer} />
    </>
  );
}
