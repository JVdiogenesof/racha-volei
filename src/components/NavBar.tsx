import Link from "next/link";
import { Home, CalendarDays, Users, Megaphone, History, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/(app)/actions";
import { Logo } from "@/components/Logo";
import { Avatar } from "@/components/Avatar";

const LINKS = [
  { href: "/", label: "Início", icon: Home },
  { href: "/racha", label: "Rachas", icon: CalendarDays },
  { href: "/jogadores", label: "Jogadores", icon: Users },
  { href: "/avisos", label: "Avisos", icon: Megaphone },
  { href: "/historico", label: "Histórico", icon: History },
];

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

  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-brand-navy text-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/">
          <Logo className="text-white" accentClassName="text-purple-300" />
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
            <link.icon className="h-5 w-5" strokeWidth={2} />
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
