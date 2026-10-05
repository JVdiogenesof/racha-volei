import { TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { getPersonalEvolution } from "@/lib/evolution";
import { getActiveCommunity } from "@/lib/community";
import { PersonalEvolutionDashboard } from "@/components/PersonalEvolutionDashboard";

export default async function EvolucaoPage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const community = await getActiveCommunity(profile);

  const report = await getPersonalEvolution(supabase, profile.id, community);

  return (
    <div className="mx-auto w-full max-w-5xl">
      <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
        <TrendingUp className="h-6 w-6 text-purple-300" strokeWidth={2} />
        Minha evolução · {community === "sand" ? "Areia" : "Quadra"}
      </h1>
      <p className="mt-1 text-sm text-white/60">Seu desempenho, suas conexões e cada racha em um só lugar.</p>
      <PersonalEvolutionDashboard report={report} />
    </div>
  );
}
