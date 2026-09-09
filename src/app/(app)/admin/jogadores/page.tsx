import { createClient } from "@/lib/supabase/server";
import { requireOrganizer } from "@/lib/auth";
import { getAllRatings, getRatingWeights } from "@/lib/ratings";
import { finalScoresForPlayer, overallScore } from "@/lib/scoring";
import { PlayerRatingEditor } from "@/components/PlayerRatingEditor";
import { ActionForm } from "@/components/ActionForm";
import { setRatingWeights } from "./actions";

export default async function AdminJogadoresPage() {
  await requireOrganizer();
  const supabase = await createClient();

  const [{ data: players }, { selfByProfile, organizerByProfile }, weights] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("status", "approved")
      .order("full_name"),
    getAllRatings(supabase),
    getRatingWeights(supabase),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-brand-navy">Notas dos jogadores</h1>
        <p className="mt-1 text-sm text-gray-500">
          A nota final combina autoavaliação e nota do organizador conforme o peso abaixo.
        </p>
      </div>

      <section className="rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold text-brand-navy">Peso da nota</h2>
        <ActionForm action={setRatingWeights} successMessage="Peso atualizado!" className="mt-4 flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500">Peso da autoavaliação</label>
            <input
              type="number"
              name="selfWeight"
              defaultValue={weights.selfWeight}
              step={0.1}
              min={0}
              max={1}
              className="mt-1 w-28 rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500">Peso do organizador</label>
            <input
              type="number"
              name="organizerWeight"
              defaultValue={weights.organizerWeight}
              step={0.1}
              min={0}
              max={1}
              className="mt-1 w-28 rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-brand-purple px-4 py-2 text-sm font-medium text-white hover:bg-brand-purple-dark"
          >
            Salvar peso
          </button>
        </ActionForm>
      </section>

      <section className="space-y-2">
        {players?.map((player) => {
          const self = selfByProfile.get(player.id) ?? {};
          const organizer = organizerByProfile.get(player.id) ?? {};
          const finalScores = finalScoresForPlayer(
            self,
            organizer,
            weights.selfWeight,
            weights.organizerWeight,
          );
          return (
            <PlayerRatingEditor
              key={player.id}
              profileId={player.id}
              fullName={player.full_name}
              overall={overallScore(finalScores)}
              organizerRatings={organizer}
            />
          );
        })}
      </section>
    </div>
  );
}
