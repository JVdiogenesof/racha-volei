import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { getActiveCommunity } from "@/lib/community";
import { cupCapacity, getFeaturedCup } from "@/lib/copaVpa";
import { MEMBER_SELECT, type CupMember, type CupTeam } from "@/lib/copaDay";
import { CopaSorteioAoVivo, type DrawMember } from "@/components/CopaSorteioAoVivo";

export default async function CopaSorteioPage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const cup = await getFeaturedCup(supabase, await getActiveCommunity());

  if (!cup) {
    return <p className="rounded-2xl border border-white/10 p-6 text-sm text-white/60">Nenhuma copa marcada por enquanto.</p>;
  }

  const [{ data: teams }, { data: revealed }, { count: planned }] = await Promise.all([
    supabase.from("cup_teams").select("id, slug, name, position").eq("cup_id", cup.id).order("position"),
    supabase.from("cup_team_members").select(MEMBER_SELECT).eq("cup_id", cup.id).not("revealed_at", "is", null).order("pick_order"),
    supabase.from("cup_team_members").select("id", { count: "exact", head: true }).eq("cup_id", cup.id),
  ]);

  const members = ((revealed ?? []) as unknown as CupMember[]).map<DrawMember>((member) => ({
    profile_id: member.profile_id,
    team_id: member.team_id,
    pot: member.pot,
    pick_order: member.pick_order,
    player: member.player,
  }));

  return (
    <div className="space-y-4">
      <Link href="/torneios-vpa/copa" className="inline-flex items-center gap-1 text-xs font-semibold text-purple-300 hover:underline">
        <ArrowLeft className="h-3.5 w-3.5" /> Copa VPA
      </Link>
      {(teams?.length ?? 0) > 0 ? (
        <CopaSorteioAoVivo
          cupId={cup.id}
          cupName={cup.name}
          teams={(teams ?? []) as CupTeam[]}
          teamSize={cup.team_size}
          totalPicks={planned ?? cupCapacity(cup)}
          initialMembers={members}
          isOrganizer={profile.is_organizer}
          hasPlan={(planned ?? 0) > 0}
        />
      ) : profile.is_organizer ? (
        <CopaSorteioAoVivo cupId={cup.id} cupName={cup.name} teams={[]} teamSize={cup.team_size} totalPicks={cupCapacity(cup)} initialMembers={[]} isOrganizer hasPlan={false} />
      ) : (
        <p className="rounded-2xl border border-white/10 p-6 text-center text-sm text-white/60">
          O sorteio dos times ainda não começou. Quando for ao vivo, ele aparece aqui para todo mundo.
        </p>
      )}
    </div>
  );
}
