import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getActiveCommunity } from "@/lib/community";
import { getRachaRecap } from "@/lib/rachaRecap";
import { RachaRecapView } from "@/components/RachaRecapView";

/** "Como foi o racha": resultado, resumo e Jogador Destaque numa tela só. */
export default async function RachaRecapPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireProfile();
  const community = await getActiveCommunity();
  const recap = await getRachaRecap(await createClient(), id);
  if (!recap || recap.event.community !== community) notFound();
  return <RachaRecapView recap={recap} isOrganizer={Boolean(profile.is_organizer)} />;
}
