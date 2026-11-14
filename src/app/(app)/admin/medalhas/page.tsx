import { requireOrganizer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getActiveCommunity } from "@/lib/community";
import { getBadgeCatalog } from "@/lib/profileCosmetics";
import { BadgeAdmin } from "@/components/BadgeAdmin";

export default async function AdminMedalhasPage() {
  await requireOrganizer();
  const supabase = await createClient();
  const community = await getActiveCommunity();

  const [catalog, { data: players }, { data: awards }] = await Promise.all([
    getBadgeCatalog(supabase),
    supabase.from("profiles").select("id, full_name, avatar_url").eq("status", "approved").contains("communities", [community]).order("full_name"),
    supabase
      .from("profile_badges")
      .select("id, badge_id, note, awarded_at, profile_id, profiles!profile_badges_profile_id_fkey(full_name)")
      .order("awarded_at", { ascending: false })
      .limit(40),
  ]);

  const recent = (awards ?? []).map((row) => ({
    id: row.id as string,
    badgeId: row.badge_id as string,
    note: (row.note as string | null) ?? null,
    awardedAt: row.awarded_at as string,
    playerName: ((row.profiles as unknown as { full_name: string } | null)?.full_name) ?? "Jogador",
  }));

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-bold text-white">Medalhas e troféus</h1>
        <p className="mt-1 text-sm text-white/55">Entregue medalhas de torneios e eventos. Quem ganha vê na vitrine do perfil e pode destacar até 3 no cartão.</p>
      </header>
      <BadgeAdmin
        catalog={catalog}
        players={(players ?? []).map((p) => ({ id: p.id as string, name: p.full_name as string }))}
        recent={recent}
      />
    </div>
  );
}
