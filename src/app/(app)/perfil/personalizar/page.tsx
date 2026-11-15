import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ProfileCustomizer } from "@/components/ProfileCustomizer";
import { getBadgeCatalog, getEarnedBadges, getProfileExtras } from "@/lib/profileCosmetics";
import { loadUnlockedLevelIds } from "@/lib/profileUnlocks";

export default async function PersonalizarPage() {
  const profile = await requireProfile();
  if (profile.status !== "approved") redirect("/perfil");

  const supabase = await createClient();
  const [extras, catalog, earned, unlockedLevelIds] = await Promise.all([
    getProfileExtras(supabase, profile.id),
    getBadgeCatalog(supabase),
    getEarnedBadges(supabase, profile.id),
    loadUnlockedLevelIds(profile),
  ]);
  const earnedIds = new Set(earned.map((item) => item.badge_id));
  const featuredBadges = extras.featured_badges
    .filter((id) => earnedIds.has(id))
    .map((id) => catalog.find((badge) => badge.id === id))
    .filter((badge): badge is NonNullable<typeof badge> => Boolean(badge));

  return (
    <div className="space-y-4">
      <div>
        <Link href="/perfil?aba=personalizar" className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-200 hover:text-white">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Voltar ao perfil
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-white">Editor de visual</h1>
        <p className="mt-1 text-sm text-white/60">Escolha sua moldura, o banner e o efeito do cartão. Dá pra testar tudo antes de salvar.</p>
      </div>
      <ProfileCustomizer
        fullName={profile.full_name}
        avatarUrl={profile.avatar_url}
        nickname={profile.nickname_badge}
        isSetter={profile.is_setter}
        current={{ frame: profile.avatar_frame, banner: extras.profile_banner, effect: extras.profile_effect }}
        unlockedLevelIds={unlockedLevelIds}
        featuredBadges={featuredBadges}
      />
    </div>
  );
}
