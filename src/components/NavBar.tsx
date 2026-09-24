import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { readProfileFromHeaders } from "@/lib/supabase/profile-header";
import { PROFILE_COLUMNS } from "@/lib/supabase/session-headers";
import { signOut } from "@/app/(app)/actions";
import { Logo } from "@/components/Logo";
import { NavIsland } from "@/components/NavIsland";
import { CompactAppHeader } from "@/components/CompactAppHeader";
import { HeaderTopBar, type HeaderEventSummary } from "@/components/HeaderTopBar";

type NavProfile = {
  full_name: string;
  avatar_url: string | null;
  is_organizer: boolean;
  status: string;
  guest_for_event_id: string | null;
};

function hoursAgoIso(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

export async function NavBar() {
  const cached = await readProfileFromHeaders<NavProfile>();
  const supabase = await createClient();

  let userId: string;
  let profile: NavProfile | null;

  if (cached) {
    userId = cached.userId;
    profile = cached.profile;
  } else {
    // Fallback: só acontece se essa requisição não passou pelo middleware.
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    userId = user.id;
    const { data } = await supabase.from("profiles").select(PROFILE_COLUMNS).eq("id", user.id).maybeSingle();
    profile = data;
  }

  if (profile?.status === "guest") {
    return (
      <header className="app-header-background sticky top-0 z-20 border-b border-white/10 text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href={`/racha/${profile.guest_for_event_id}`}>
            <Logo markClassName="h-10 w-10" />
          </Link>
          <p className="hidden text-sm text-white/70 sm:block">
            Acesso de convidado(a) — {profile.full_name}
          </p>
          <form action={signOut}>
            <button className="rounded-md bg-white/10 px-3 py-1.5 text-xs font-medium hover:bg-white/20">
              Sair
            </button>
          </form>
        </div>
      </header>
    );
  }

  const threeDaysAgo = hoursAgoIso(72);
  const today = new Date().toISOString().slice(0, 10);

  const [{ count: newAvisosCount }, { data: upcomingEvents }] = await Promise.all([
    supabase
      .from("announcements")
      .select("id", { count: "exact", head: true })
      .gte("created_at", threeDaysAgo),
    supabase.from("events").select("id, date, time").gte("date", today).neq("status", "finished").order("date", { ascending: true }).order("time", { ascending: true }),
  ]);

  let pendingConfirmCount = 0;
  let nextEvent: HeaderEventSummary | null = null;
  if (upcomingEvents?.length) {
    const { data: myAttendance } = await supabase
      .from("attendance")
      .select("event_id, status")
      .eq("profile_id", userId)
      .in(
        "event_id",
        upcomingEvents.map((e) => e.id),
      );
    const respondedIds = new Set((myAttendance ?? []).map((a) => a.event_id));
    pendingConfirmCount = upcomingEvents.filter((e) => !respondedIds.has(e.id)).length;
    const nearest = upcomingEvents[0];
    const attendance = (myAttendance ?? []).find((item) => item.event_id === nearest.id);
    nextEvent = {
      id: nearest.id,
      dateLabel: new Date(`${nearest.date}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" }).replace(".", ""),
      time: nearest.time,
      attendanceStatus: (attendance?.status as HeaderEventSummary["attendanceStatus"]) ?? null,
    };
  }

  const badgeByHref: Record<string, number> = {
    "/avisos": newAvisosCount ?? 0,
    "/racha": pendingConfirmCount,
  };

  return (
    <CompactAppHeader
      topBar={
        <HeaderTopBar fullName={profile?.full_name ?? "Atleta VPA"} avatarUrl={profile?.avatar_url ?? null} isOrganizer={profile?.is_organizer ?? false} nextEvent={nextEvent} signOutAction={signOut} />
      }
      navigation={<NavIsland badgeByHref={badgeByHref} isOrganizer={profile?.is_organizer ?? false} />}
    />
  );
}
