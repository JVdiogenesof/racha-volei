import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { ActionForm } from "@/components/ActionForm";
import { voteMvp } from "./actions";

export default async function MvpPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: event } = await supabase.from("events").select("id, date, status").eq("id", id).maybeSingle();
  if (!event) notFound();

  const eventFinished = event.status === "finished";

  const { data: confirmed } = await supabase
    .from("attendance")
    .select("profile_id, profiles(full_name)")
    .eq("event_id", id)
    .eq("status", "confirmed");

  const { data: myVote } = await supabase
    .from("mvp_votes")
    .select("voted_for_profile_id")
    .eq("event_id", id)
    .eq("voter_profile_id", profile.id)
    .maybeSingle();

  const canVote = eventFinished && !myVote;
  const canSeeResults = eventFinished && (Boolean(myVote) || profile.is_organizer);

  const { data: allVotes } = canSeeResults
    ? await supabase.from("mvp_votes").select("voted_for_profile_id").eq("event_id", id)
    : { data: null };

  const tally = new Map<string, number>();
  for (const v of allVotes ?? []) {
    tally.set(v.voted_for_profile_id, (tally.get(v.voted_for_profile_id) ?? 0) + 1);
  }

  const candidatos = (confirmed ?? []).map((c) => ({
    profileId: c.profile_id,
    fullName: (c.profiles as unknown as { full_name: string } | null)?.full_name ?? "—",
    votes: tally.get(c.profile_id) ?? 0,
  }));

  const maxVotes = Math.max(0, ...candidatos.map((c) => c.votes));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-navy">
          MVP · {new Date(`${event.date}T00:00:00`).toLocaleDateString("pt-BR")}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {!eventFinished
            ? "A votação abre depois que o organizador terminar o evento."
            : myVote
              ? "Você já votou."
              : "Vote em quem jogou melhor no racha."}
          {eventFinished && !myVote && profile.is_organizer && " Como organizador, você já vê o placar parcial abaixo."}
        </p>
      </div>

      {!eventFinished ? (
        <p className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
          Ainda não dá pra escolher o MVP — o racha precisa ser finalizado primeiro.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200">
          {candidatos.map((c) => (
            <li key={c.profileId} className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="text-sm text-brand-navy">
                {canSeeResults && c.votes === maxVotes && maxVotes > 0 && "🏆 "}
                {c.fullName}
              </span>
              <div className="flex items-center gap-3">
                {canSeeResults && (
                  <span className="text-sm font-medium text-brand-purple">{c.votes} voto(s)</span>
                )}
                {canVote && (
                  <ActionForm action={voteMvp} successMessage="Voto registrado!">
                    <input type="hidden" name="eventId" value={id} />
                    <input type="hidden" name="votedForProfileId" value={c.profileId} />
                    <button className="rounded-lg bg-brand-purple px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-purple-dark">
                      Votar
                    </button>
                  </ActionForm>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
