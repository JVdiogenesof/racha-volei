import { signOut } from "@/app/(app)/actions";
import { NavIsland } from "@/components/NavIsland";
import { CompactAppHeader } from "@/components/CompactAppHeader";
import { HeaderTopBar, type HeaderEventSummary } from "@/components/HeaderTopBar";
import { parseCommunities, type Community } from "@/lib/community";
import type { AppChromeData } from "@/lib/appChromeData";

type NavProfile = {
  full_name: string;
  avatar_url: string | null;
  is_organizer: boolean;
  status: string;
  guest_for_event_id: string | null;
  communities: string[] | null;
};

export async function NavBar({ profile, activeCommunity, chromeData }: { profile: NavProfile; activeCommunity: Community; chromeData: Promise<AppChromeData> }) {
  const { newAvisosCount, upcomingEvents, attendanceByEvent } = await chromeData;
  const availableCommunities = profile.is_organizer ? parseCommunities(["court", "sand"]) : parseCommunities(profile.communities);

  let pendingConfirmCount = 0;
  let nextEvent: HeaderEventSummary | null = null;
  if (upcomingEvents?.length) {
    const respondedIds = new Set(attendanceByEvent.keys());
    pendingConfirmCount = profile.status === "approved"
      ? upcomingEvents.filter((e) => !respondedIds.has(e.id)).length
      : 0;
    const nearest = upcomingEvents[0];
    nextEvent = {
      id: nearest.id,
      dateLabel: new Date(`${nearest.date}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" }).replace(".", ""),
      time: nearest.time,
      startsAt: `${nearest.date}T${nearest.time ?? "23:59:00"}-03:00`,
      attendanceStatus: (attendanceByEvent.get(nearest.id) as HeaderEventSummary["attendanceStatus"]) ?? null,
    };
  }

  const badgeByHref: Record<string, number> = {
    "/avisos": newAvisosCount,
    "/racha": pendingConfirmCount,
  };

  return (
    <CompactAppHeader
      topBar={
        <HeaderTopBar fullName={profile.full_name} avatarUrl={profile.avatar_url} isOrganizer={profile.is_organizer} isVisitor={profile.status !== "approved"} nextEvent={nextEvent} activeCommunity={activeCommunity} availableCommunities={availableCommunities} signOutAction={signOut} />
      }
      navigation={<NavIsland badgeByHref={badgeByHref} isOrganizer={profile.is_organizer} canViewShirts />}
    />
  );
}
