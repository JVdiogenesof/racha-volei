import { notFound } from "next/navigation";
import { Trophy, X } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { Avatar } from "@/components/Avatar";
import { ActionForm } from "@/components/ActionForm";
import { setMvp, clearMvp } from "./actions";

type Candidato = { profileId: string; fullName: string; avatarUrl: string | null };

export default async function MvpPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireProfile();
  const supabase = await createClient();

  const [{ data: event }, { data: confirmed }] = await Promise.all([
    supabase.from("events").select("id, date, status, mvp_profile_id, mvp_profile_id_2").eq("id", id).maybeSingle(),
    supabase
      .from("attendance")
      .select("profile_id, profiles(full_name, avatar_url)")
      .eq("event_id", id)
      .eq("status", "confirmed"),
  ]);
  if (!event) notFound();

  const eventFinished = event.status === "finished";

  const candidatos: Candidato[] = (confirmed ?? [])
    .map((c) => {
      const p = c.profiles as unknown as { full_name: string; avatar_url: string | null } | null;
      return {
        profileId: c.profile_id,
        fullName: p?.full_name ?? "—",
        avatarUrl: p?.avatar_url ?? null,
      };
    })
    .sort((a, b) => a.fullName.localeCompare(b.fullName));

  const candidatoById = new Map(candidatos.map((c) => [c.profileId, c]));
  const destaques = [event.mvp_profile_id, event.mvp_profile_id_2]
    .map((pid) => (pid ? candidatoById.get(pid) ?? null : null))
    .filter((c): c is Candidato => c !== null);

  const slots: { slot: "1" | "2"; profileId: string | null }[] = [
    { slot: "1", profileId: event.mvp_profile_id },
    { slot: "2", profileId: event.mvp_profile_id_2 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
          <Trophy className="h-6 w-6 text-purple-300" strokeWidth={2} />
          Jogadores Destaque · {new Date(`${event.date}T00:00:00`).toLocaleDateString("pt-BR")}
        </h1>
        <p className="mt-1 text-sm text-white/60">
          {!eventFinished
            ? "Libera depois que o organizador terminar o evento."
            : profile.is_organizer
              ? "Escolha até dois melhores jogadores desse racha."
              : "Os Jogadores Destaque são escolhidos pelos organizadores depois do racha."}
        </p>
      </div>

      {!eventFinished ? (
        <p className="rounded-xl border border-white/10 bg-white/5 px-4 py-6 text-center text-sm text-white/60">
          Ainda não dá pra escolher os Jogadores Destaque — o racha precisa ser finalizado primeiro.
        </p>
      ) : !profile.is_organizer ? (
        <div className="rounded-xl border border-white/10 px-4 py-8 text-center">
          {destaques.length ? (
            <div className="flex flex-wrap items-center justify-center gap-8">
              {destaques.map((d) => (
                <div key={d.profileId}>
                  <Avatar src={d.avatarUrl} name={d.fullName} size="md" />
                  <p className="mt-3 text-lg font-semibold text-white">🏆 {d.fullName}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-white/60">Os organizadores ainda não escolheram os Jogadores Destaque.</p>
          )}
          {destaques.length > 0 && (
            <p className="mt-3 text-sm text-white/60">
              {destaques.length > 1 ? "foram os Jogadores Destaque" : "foi o Jogador Destaque"} desse racha!
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {slots.map(({ slot, profileId }) => {
            const chosen = profileId ? candidatoById.get(profileId) ?? null : null;
            const otherProfileId = slot === "1" ? event.mvp_profile_id_2 : event.mvp_profile_id;
            return (
              <section key={slot}>
                <h2 className="mb-2 text-sm font-semibold text-white/70">Jogador Destaque {slot}</h2>
                {chosen ? (
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar src={chosen.avatarUrl} name={chosen.fullName} size="sm" />
                      <span className="truncate text-sm text-white">🏆 {chosen.fullName}</span>
                    </div>
                    <ActionForm action={clearMvp} successMessage="Escolha removida.">
                      <input type="hidden" name="eventId" value={id} />
                      <input type="hidden" name="slot" value={slot} />
                      <button
                        type="submit"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-white/70 hover:bg-white/5"
                      >
                        <X className="h-3.5 w-3.5" strokeWidth={2} />
                        Remover escolha
                      </button>
                    </ActionForm>
                  </div>
                ) : (
                  <ul className="divide-y divide-white/10 rounded-xl border border-white/10">
                    {candidatos
                      .filter((c) => c.profileId !== otherProfileId)
                      .map((c) => (
                        <li key={c.profileId} className="flex items-center justify-between gap-3 px-4 py-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <Avatar src={c.avatarUrl} name={c.fullName} size="sm" />
                            <span className="truncate text-sm text-white">{c.fullName}</span>
                          </div>
                          <ActionForm action={setMvp} successMessage={`${c.fullName} escolhido(a) como Jogador Destaque!`}>
                            <input type="hidden" name="eventId" value={id} />
                            <input type="hidden" name="profileId" value={c.profileId} />
                            <input type="hidden" name="slot" value={slot} />
                            <button
                              type="submit"
                              className="rounded-lg bg-brand-purple px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-purple-dark"
                            >
                              Escolher
                            </button>
                          </ActionForm>
                        </li>
                      ))}
                    {!candidatos.filter((c) => c.profileId !== otherProfileId).length && (
                      <li className="px-4 py-6 text-center text-sm text-white/60">Ninguém disponível pra escolher.</li>
                    )}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
