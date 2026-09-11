import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { readProfileFromHeaders } from "@/lib/supabase/profile-header";
import { PROFILE_COLUMNS } from "@/lib/supabase/session-headers";
import { signOut } from "@/app/(app)/actions";
import { Logo } from "@/components/Logo";
import { Avatar } from "@/components/Avatar";
import { NavIsland } from "@/components/NavIsland";

type NavProfile = {
  full_name: string;
  avatar_url: string | null;
  is_organizer: boolean;
  status: string;
  guest_for_event_id: string | null;
};

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
      <header className="sticky top-0 z-20 border-b border-white/10 bg-brand-navy text-white">
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

  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const today = new Date().toISOString().slice(0, 10);

  const [{ count: newAvisosCount }, { data: upcomingEvents }] = await Promise.all([
    supabase
      .from("announcements")
      .select("id", { count: "exact", head: true })
      .gte("created_at", threeDaysAgo),
    supabase.from("events").select("id").gte("date", today).neq("status", "finished"),
  ]);

  let pendingConfirmCount = 0;
  if (upcomingEvents?.length) {
    const { data: myAttendance } = await supabase
      .from("attendance")
      .select("event_id")
      .eq("profile_id", userId)
      .in(
        "event_id",
        upcomingEvents.map((e) => e.id),
      );
    const respondedIds = new Set((myAttendance ?? []).map((a) => a.event_id));
    pendingConfirmCount = upcomingEvents.filter((e) => !respondedIds.has(e.id)).length;
  }

  const badgeByHref: Record<string, number> = {
    "/avisos": newAvisosCount ?? 0,
    "/racha": pendingConfirmCount,
  };

  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-brand-navy text-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/">
          <Logo markClassName="h-10 w-10" />
        </Link>
        <div className="flex items-center gap-2.5">
          <Link
            href="/perfil"
            className="flex items-center gap-2 text-sm text-white/80 hover:text-white"
          >
            <Avatar src={profile?.avatar_url} name={profile?.full_name ?? "?"} size="sm" />
            <span className="hidden sm:inline">{profile?.full_name?.split(" ")[0] ?? "Perfil"}</span>
          </Link>
          <form action={signOut}>
            <button className="rounded-md bg-white/10 px-3 py-1.5 text-xs font-medium hover:bg-white/20">
              Sair
            </button>
          </form>
        </div>
      </div>
      <NavIsland badgeByHref={badgeByHref} isOrganizer={profile?.is_organizer ?? false} />
    </header>
  );
}
