import { notFound } from "next/navigation";
import { Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { Avatar } from "@/components/Avatar";
import { ActionForm } from "@/components/ActionForm";
import { voteMvp } from "./actions";

export default async function MvpPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireProfile();
  const supabase = await createClient();

  const [{ data: event }, { data: confirmed }, { data: myVote }, { count: votesCount }] = await Promise.all([
    supabase.from("events").select("id, date, status").eq("id", id).maybeSingle(),
    supabase
      .from("attendance")
      .select("profile_id, profiles(full_name, avatar_url)")
      .eq("event_id", id)
      .eq("status", "confirmed"),
    supabase
      .from("mvp_votes")
      .select("voted_for_profile_id")
      .eq("event_id", id)
      .eq("voter_profile_id", profile.id)
      .maybeSingle(),
    supabase.from("mvp_votes").select("id", { count: "exact", head: true }).eq("event_id", id),
  ]);
  if (!event) notFound();

  const eventFinished = event.status === "finished";
  const totalConfirmed = confirmed?.length ?? 0;

  const votingClosed = totalConfirmed > 0 && (votesCount ?? 0) > totalConfirmed / 2;

  const canVote = eventFinished && !myVote && !votingClosed;
  const canSeeResults = eventFinished && (Boolean(myVote) || profile.is_organizer || votingClosed);

  const { data: allVotes } = canSeeResults
    ? await supabase.from("mvp_votes").select("voted_for_profile_id").eq("event_id", id)
    : { data: null };

  const tally = new Map<string, number>();
  for (const v of allVotes ?? []) {
    tally.set(v.voted_for_profile_id, (tally.get(v.voted_for_profile_id) ?? 0) + 1);
  }

  const candidatos = (confirmed ?? [])
    .map((c) => {
      const p = c.profiles as unknown as { full_name: string; avatar_url: string | null } | null;
      return {
        profileId: c.profile_id,
        fullName: p?.full_name ?? "—",
        avatarUrl: p?.avatar_url ?? null,
        votes: tally.get(c.profile_id) ?? 0,
      };
    })
    .sort((a, b) => (canSeeResults ? b.votes - a.votes : a.fullName.localeCompare(b.fullName)));

  const maxVotes = Math.max(0, ...candidatos.map((c) => c.votes));
  const faltam = Math.max(0, Math.floor(totalConfirmed / 2) + 1 - (votesCount ?? 0));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-brand-navy">
          <Trophy className="h-6 w-6 text-brand-purple" strokeWidth={2} />
          MVP · {new Date(`${event.date}T00:00:00`).toLocaleDateString("pt-BR")}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {!eventFinished
            ? "A votação abre depois que o organizador terminar o evento."
            : votingClosed
              ? "Votação encerrada — a maioria já votou."
              : myVote
                ? "Você já votou. Aguarde o resultado."
                : "Vote em quem jogou melhor no racha (menos em você mesmo 😉)."}
        </p>
      </div>

      {!eventFinished ? (
        <p className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
          Ainda não dá pra escolher o MVP — o racha precisa ser finalizado primeiro.
        </p>
      ) : (
        <>
          {!canSeeResults && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>
                  {votesCount ?? 0} de {totalConfirmed} confirmados já votaram
                </span>
                <span>faltam {faltam} pra fechar</span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                <div
                  className="h-full rounded-full bg-brand-purple transition-all"
                  style={{
                    width: `${totalConfirmed ? Math.min(100, ((votesCount ?? 0) / totalConfirmed) * 100) : 0}%`,
                  }}
                />
              </div>
            </div>
          )}

          <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200">
            {candidatos.map((c) => {
              const isMe = c.profileId === profile.id;
              const isLeader = canSeeResults && c.votes === maxVotes && maxVotes > 0;
              return (
                <li
                  key={c.profileId}
                  className={`flex items-center justify-between gap-3 px-4 py-3 ${isLeader ? "bg-amber-50/60" : ""}`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar src={c.avatarUrl} name={c.fullName} size="sm" />
                    <span className="truncate text-sm text-brand-navy">
                      {isLeader && "🏆 "}
                      {c.fullName}
                      {isMe && <span className="text-gray-400"> (você)</span>}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {canSeeResults && (
                      <span className="text-sm font-medium text-brand-purple">{c.votes} voto(s)</span>
                    )}
                    {canVote && !isMe && (
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
              );
            })}
            {!candidatos.length && (
              <li className="px-4 py-6 text-center text-sm text-gray-500">Ninguém confirmou presença nesse racha.</li>
            )}
          </ul>
        </>
      )}
    </div>
  );
}
