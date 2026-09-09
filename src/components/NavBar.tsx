import Link from "next/link";
import { Home, CalendarDays, Users, Award, Megaphone, History, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/(app)/actions";
import { Logo } from "@/components/Logo";
import { Avatar } from "@/components/Avatar";

const LINKS = [
  { href: "/", label: "Início", icon: Home },
  { href: "/racha", label: "Rachas", icon: CalendarDays },
  { href: "/jogadores", label: "Jogadores", icon: Users },
  { href: "/ranking", label: "Ranking", icon: Award },
  { href: "/avisos", label: "Avisos", icon: Megaphone },
  { href: "/historico", label: "Histórico", icon: History },
];

function NavBadge({ count }: { count: number }) {
  if (!count) return null;
  return (
    <span className="ml-0.5 inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
      {count > 9 ? "9+" : count}
    </span>
  );
}

export async function NavBar() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, avatar_url, is_organizer")
    .eq("id", user.id)
    .maybeSingle();

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
      .eq("profile_id", user.id)
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
        <nav className="hidden items-center gap-1 text-sm font-medium sm:flex">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-white/80 transition hover:bg-white/10 hover:text-white"
            >
              <link.icon className="h-4 w-4" strokeWidth={2} />
              {link.label}
              <NavBadge count={badgeByHref[link.href] ?? 0} />
            </Link>
          ))}
          {profile?.is_organizer && (
            <Link
              href="/admin/solicitacoes"
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-purple-300 transition hover:bg-white/10 hover:text-purple-200"
            >
              <ShieldCheck className="h-4 w-4" strokeWidth={2} />
              Admin
            </Link>
          )}
        </nav>
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
      <nav className="flex items-center gap-1 overflow-x-auto border-t border-white/10 px-2 py-2 text-xs font-medium sm:hidden">
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="flex shrink-0 flex-col items-center gap-1 rounded-lg px-3 py-1.5 text-white/80"
          >
            <span className="relative">
              <link.icon className="h-5 w-5" strokeWidth={2} />
              {Boolean(badgeByHref[link.href]) && (
                <span className="absolute -right-1.5 -top-1.5 h-2.5 w-2.5 rounded-full bg-red-500" />
              )}
            </span>
            {link.label}
          </Link>
        ))}
        {profile?.is_organizer && (
          <Link
            href="/admin/solicitacoes"
            className="flex shrink-0 flex-col items-center gap-1 rounded-lg px-3 py-1.5 text-purple-300"
          >
            <ShieldCheck className="h-5 w-5" strokeWidth={2} />
            Admin
          </Link>
        )}
      </nav>
    </header>
  );
}
