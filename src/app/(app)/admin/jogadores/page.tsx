import { UserRoundCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireOrganizer } from "@/lib/auth";
import { getAllRatings, getRatingWeights } from "@/lib/ratings";
import { finalScoresForPlayer, overallScore } from "@/lib/scoring";
import { PlayerRatingEditor } from "@/components/PlayerRatingEditor";
import { ActionForm } from "@/components/ActionForm";
import { Avatar } from "@/components/Avatar";
import { restoreMember, setRatingWeights } from "./actions";

export default async function AdminJogadoresPage() {
  await requireOrganizer();
  const supabase = await createClient();

  const [{ data: players }, { data: removedPlayers }, { selfByProfile, organizerByProfile }, weights] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, avatar_url, nickname_badge")
      .eq("status", "approved")
      .order("full_name"),
    supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .eq("status", "removed")
      .order("full_name"),
    getAllRatings(supabase),
    getRatingWeights(supabase),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Notas dos jogadores</h1>
        <p className="mt-1 text-sm text-white/60">
          A nota final combina autoavaliação e nota do organizador conforme o peso abaixo.
        </p>
      </div>

      <section className="rounded-xl border border-white/10 p-6">
        <h2 className="font-semibold text-white">Peso da nota</h2>
        <ActionForm action={setRatingWeights} successMessage="Peso atualizado!" className="mt-4 flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-white/60">Peso da autoavaliação</label>
            <input
              type="number"
              name="selfWeight"
              defaultValue={weights.selfWeight}
              step={0.1}
              min={0}
              max={1}
              className="mt-1 w-28 rounded-lg border border-white/15 px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-white/60">Peso do organizador</label>
            <input
              type="number"
              name="organizerWeight"
              defaultValue={weights.organizerWeight}
              step={0.1}
              min={0}
              max={1}
              className="mt-1 w-28 rounded-lg border border-white/15 px-3 py-2"
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
              avatarUrl={player.avatar_url}
              nicknameBadge={player.nickname_badge}
              overall={overallScore(finalScores)}
              organizerRatings={organizer}
            />
          );
        })}
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:p-6">
        <div>
          <h2 className="font-semibold text-white">Pessoas removidas ({removedPlayers?.length ?? 0})</h2>
          <p className="mt-1 text-sm text-white/50">
            Restaure o acesso sem apagar ou reiniciar o histórico da pessoa.
          </p>
        </div>

        {removedPlayers?.length ? (
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {removedPlayers.map((player) => (
              <li key={player.id} className="flex min-w-0 items-center gap-3 rounded-xl border border-white/10 bg-white/[0.035] p-3">
                <Avatar src={player.avatar_url} name={player.full_name} size="sm" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-white">{player.full_name}</span>
                <ActionForm action={restoreMember} successMessage={`${player.full_name} recuperou o acesso.`} className="shrink-0">
                  <input type="hidden" name="profileId" value={player.id} />
                  <button
                    type="submit"
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-green-400/30 bg-green-500/15 px-3 py-1.5 text-xs font-semibold text-green-300 hover:bg-green-500/25"
                  >
                    <UserRoundCheck className="h-4 w-4" strokeWidth={2} />
                    Restaurar acesso
                  </button>
                </ActionForm>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 rounded-xl border border-white/8 bg-white/[0.025] px-4 py-3 text-sm text-white/40">
            Nenhuma pessoa removida no momento.
          </p>
        )}
      </section>
    </div>
  );
}
