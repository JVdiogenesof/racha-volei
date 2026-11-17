import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { getActiveCommunity } from "@/lib/community";
import { cupCapacity, getFeaturedCup } from "@/lib/copaVpa";
import { getDrawPool, MEMBER_SELECT, type CupMember, type CupTeam } from "@/lib/copaDay";
import { COPA_TEAMS } from "@/lib/copaDraw";
import { CopaSorteioAoVivo, type DrawMember, type PoolPlayer } from "@/components/CopaSorteioAoVivo";

export default async function CopaSorteioPage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const cup = await getFeaturedCup(supabase, await getActiveCommunity());

  if (!cup) {
    return <p className="rounded-2xl border border-white/10 p-6 text-sm text-white/60">Nenhuma copa marcada por enquanto.</p>;
  }

  const [{ data: teams }, { data: revealed }, { count: planned }, { data: qualifiedRows }, drawPool] = await Promise.all([
    supabase.from("cup_teams").select("id, slug, name, position").eq("cup_id", cup.id).order("position"),
    supabase.from("cup_team_members").select(MEMBER_SELECT).eq("cup_id", cup.id).not("revealed_at", "is", null).order("pick_order"),
    supabase.from("cup_team_members").select("id", { count: "exact", head: true }).eq("cup_id", cup.id),
    supabase
      .from("cup_qualified_players")
      .select("profile_id, player:profiles!cup_qualified_players_profile_id_fkey(full_name, avatar_url, avatar_frame, is_setter)")
      .eq("cup_id", cup.id),
    profile.is_organizer ? getDrawPool(supabase, cup).catch(() => null) : Promise.resolve(null),
  ]);

  const members = ((revealed ?? []) as unknown as CupMember[]).map<DrawMember>((member) => ({
    profile_id: member.profile_id,
    team_id: member.team_id,
    pot: member.pot,
    pick_order: member.pick_order,
    player: member.player,
  }));

  // Rostos da roleta: quem entra no sorteio (com confirmação, só os confirmados; a lista de classificados já é pública).
  const inDraw = drawPool ? new Set(drawPool.pool.map((row) => row.profileId)) : null;
  const pool: PoolPlayer[] = ((qualifiedRows ?? []) as unknown as { profile_id: string; player: { full_name: string; avatar_url: string | null; avatar_frame: string | null; is_setter: boolean } | null }[])
    .filter((row) => row.player && (!inDraw || inDraw.has(row.profile_id)))
    .map((row) => ({ id: row.profile_id, name: row.player!.full_name, avatar: row.player!.avatar_url, frame: row.player!.avatar_frame, isSetter: row.player!.is_setter }));

  // Antes do sorteio ser preparado, a tela já mostra os times (só a identidade) para a galera esperar ali.
  const shownTeams: CupTeam[] = (teams ?? []).length
    ? ((teams ?? []) as CupTeam[])
    : COPA_TEAMS.slice(0, cup.num_teams).map((team, index) => ({ id: `preview-${team.slug}`, slug: team.slug, name: team.name, position: index + 1 }));

  return (
    <div className="space-y-4">
      <Link href="/torneios-vpa/copa" className="inline-flex items-center gap-1 text-xs font-semibold text-purple-300 hover:underline">
        <ArrowLeft className="h-3.5 w-3.5" /> Copa VPA
      </Link>
      <CopaSorteioAoVivo
        cupId={cup.id}
        cupName={cup.name}
        teams={shownTeams}
        teamSize={cup.team_size}
        totalPicks={planned || cupCapacity(cup)}
        initialMembers={members}
        isOrganizer={profile.is_organizer}
        hasPlan={(planned ?? 0) > 0}
        pool={pool}
        readiness={drawPool?.readiness ?? null}
      />
    </div>
  );
}
