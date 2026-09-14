import Link from "next/link";
import { Swords } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { readProfileFromHeaders } from "@/lib/supabase/profile-header";
import { PROFILE_COLUMNS } from "@/lib/supabase/session-headers";

type ReactionsProfile = { status: string };

export async function ReactionsShortcut() {
  const supabase = await createClient();
  const cached = await readProfileFromHeaders<ReactionsProfile>();

  let profile: ReactionsProfile | null;
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

  return (
    <Link
      href="/reacoes"
      aria-label="Reações"
      title="Reações"
      className="fixed bottom-24 left-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-brand-purple text-white shadow-lg hover:bg-brand-purple-dark"
    >
      <Swords className="h-6 w-6" strokeWidth={2} />
    </Link>
  );
}
