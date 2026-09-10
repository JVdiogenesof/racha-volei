import { notFound } from "next/navigation";
import { Check, X, ThumbsUp, Rocket, Undo2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { getAllRatings, getRatingWeights } from "@/lib/ratings";
import { finalScoresForPlayer, overallScore } from "@/lib/scoring";
import { Avatar } from "@/components/Avatar";
import { ActionForm } from "@/components/ActionForm";
import { RemoveAttendanceButton } from "@/components/RemoveAttendanceButton";
import { setAttendance, setOfficialListOpen, removeAttendance } from "./actions";

export default async function ConfirmarPresencaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await requireProfile();
  const supabase = await createClient();

  const [{ data: event }, { data: attendanceList }, { data: myAttendance }, ratingsData] = await Promise.all([
    supabase.from("events").select("id, date, status, official_list_open").eq("id", id).maybeSingle(),
    supabase
      .from("attendance")
      .select("profile_id, status, profiles(full_name, avatar_url)")
      .eq("event_id", id)
      .order("confirmed_at", { ascending: true }),
    supabase.from("attendance").select("status").eq("event_id", id).eq("profile_id", profile.id).maybeSingle(),
    profile.is_organizer
      ? Promise.all([getAllRatings(supabase), getRatingWeights(supabase)])
      : Promise.resolve(null),
  ]);

  if (!event) notFound();

  const eventFinished = event.status === "finished";
  const eventCancelled = event.status === "cancelled";
  const listOpen = event.official_list_open;
  const dateLabel = new Date(`${event.date}T00:00:00`).toLocaleDateString("pt-BR");

  const confirmados = attendanceList?.filter((a) => a.status === "confirmed") ?? [];
  const interessados = attendanceList?.filter((a) => a.status === "interested") ?? [];

  function overallFor(profileId: string) {
    if (!ratingsData) return null;
    const [{ selfByProfile, organizerByProfile }, weights] = ratingsData;
    const scores = finalScoresForPlayer(
      selfByProfile.get(profileId) ?? {},
      organizerByProfile.get(profileId) ?? {},
      weights.selfWeight,
      weights.organizerWeight,
    );
    return overallScore(scores);
  }

  const myStatus = myAttendance?.status;
  const statusLabel =
    myStatus === "confirmed"
      ? "Confirmado"
      : myStatus === "interested"
        ? "Interesse marcado"
        : myStatus === "declined"
          ? "Não vai"
          : "Ainda não respondeu";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-navy">
          {listOpen ? "Entrar na lista do racha" : "Interesse no racha"} · {dateLabel}
        </h1>
        {!eventCancelled && !eventFinished && (
          <p className="mt-1 text-sm text-gray-500">
            {listOpen
              ? "A lista oficial está aberta — confirme sua presença pra garantir vaga nos times."
              : "Diz que topa pra gente ver quem tá on antes de abrir a lista oficial."}
          </p>
        )}
        <p className="mt-1 text-sm text-gray-500">
          Situação atual: <strong>{statusLabel}</strong>
        </p>
      </div>

      {myStatus === "interested" && listOpen && !eventFinished && !eventCancelled && (
        <p className="rounded-xl border border-brand-purple/30 bg-brand-purple/5 px-4 py-3 text-sm text-brand-navy">
          Você tinha marcado interesse e a lista oficial abriu! Confirme sua presença abaixo pra garantir sua vaga. 🙌
        </p>
      )}

      {eventCancelled ? (
        <p className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-4 text-sm text-orange-700">
          Esse racha foi cancelado — não dá mais pra responder.
        </p>
      ) : eventFinished ? (
        <p className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-4 text-sm text-gray-500">
          Esse racha já terminou — não dá mais pra responder.
        </p>
      ) : listOpen ? (
        <div className="flex gap-3">
          <ActionForm action={setAttendance} successMessage="Presença confirmada!">
            <input type="hidden" name="eventId" value={id} />
            <input type="hidden" name="status" value="confirmed" />
            <button className="inline-flex items-center gap-1.5 rounded-lg bg-brand-purple px-4 py-2 font-medium text-white hover:bg-brand-purple-dark">
              <Check className="h-4 w-4" strokeWidth={2} />
              Confirmar presença
            </button>
          </ActionForm>
          <ActionForm action={setAttendance} successMessage="Você marcou que não vai.">
            <input type="hidden" name="eventId" value={id} />
            <input type="hidden" name="status" value="declined" />
            <button className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-600 hover:bg-gray-50">
              <X className="h-4 w-4" strokeWidth={2} />
              Não vou
            </button>
          </ActionForm>
        </div>
      ) : (
        <div className="flex gap-3">
          <ActionForm action={setAttendance} successMessage="Interesse registrado!">
            <input type="hidden" name="eventId" value={id} />
            <input type="hidden" name="status" value="interested" />
            <button className="inline-flex items-center gap-1.5 rounded-lg bg-brand-purple px-4 py-2 font-medium text-white hover:bg-brand-purple-dark">
              <ThumbsUp className="h-4 w-4" strokeWidth={2} />
              Tenho interesse
            </button>
          </ActionForm>
          <ActionForm action={setAttendance} successMessage="Você marcou que não vai.">
            <input type="hidden" name="eventId" value={id} />
            <input type="hidden" name="status" value="declined" />
            <button className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-600 hover:bg-gray-50">
              <X className="h-4 w-4" strokeWidth={2} />
              Não vou
            </button>
          </ActionForm>
        </div>
      )}

      {profile.is_organizer && !eventFinished && !eventCancelled && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
          {listOpen ? (
            <>
              <p className="text-sm text-gray-600">A lista oficial está aberta pra esse racha.</p>
              <ActionForm
                action={setOfficialListOpen}
                successMessage="Voltou pra fase de interesse."
                className="ml-auto shrink-0"
              >
                <input type="hidden" name="eventId" value={id} />
                <input type="hidden" name="open" value="false" />
                <button className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-white">
                  <Undo2 className="h-4 w-4" strokeWidth={2} />
                  Voltar pra interesse
                </button>
              </ActionForm>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-600">
                {interessados.length} {interessados.length === 1 ? "pessoa demonstrou" : "pessoas demonstraram"}{" "}
                interesse até agora.
              </p>
              <ActionForm
                action={setOfficialListOpen}
                successMessage="Lista oficial aberta! Quem tinha interesse precisa confirmar presença."
                className="ml-auto shrink-0"
              >
                <input type="hidden" name="eventId" value={id} />
                <input type="hidden" name="open" value="true" />
                <button className="inline-flex items-center gap-1.5 rounded-lg bg-brand-navy px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-navy-light">
                  <Rocket className="h-4 w-4" strokeWidth={2} />
                  Abrir lista oficial
                </button>
              </ActionForm>
            </>
          )}
        </div>
      )}

      {listOpen ? (
        <>
          <section>
            <h2 className="font-semibold text-brand-navy">Confirmados ({confirmados.length})</h2>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {confirmados.map((a) => {
                const p = a.profiles as unknown as { full_name: string; avatar_url: string | null } | null;
                return (
                  <li
                    key={a.profile_id}
                    className="flex items-center gap-3 rounded-lg border border-gray-200 px-3 py-2.5"
                  >
                    <Avatar src={p?.avatar_url} name={p?.full_name ?? "?"} size="sm" />
                    <span className="flex-1 truncate text-sm text-brand-navy">{p?.full_name}</span>
                    {profile.is_organizer && (
                      <RemoveAttendanceButton
                        eventId={id}
                        profileId={a.profile_id}
                        fullName={p?.full_name ?? "esse jogador"}
                        action={removeAttendance}
                      />
                    )}
                  </li>
                );
              })}
              {!confirmados.length && <li className="text-sm text-gray-500">Ninguém confirmou ainda.</li>}
            </ul>
          </section>

          {profile.is_organizer && interessados.length > 0 && (
            <section>
              <h2 className="font-semibold text-brand-navy">
                Interessados que ainda não confirmaram ({interessados.length})
              </h2>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {interessados.map((a) => {
                  const p = a.profiles as unknown as { full_name: string; avatar_url: string | null } | null;
                  return (
                    <li
                      key={a.profile_id}
                      className="flex items-center gap-3 rounded-lg border border-dashed border-gray-200 px-3 py-2.5 text-gray-500"
                    >
                      <Avatar src={p?.avatar_url} name={p?.full_name ?? "?"} size="sm" />
                      <span className="flex-1 truncate text-sm">{p?.full_name}</span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </>
      ) : (
        <section>
          <h2 className="font-semibold text-brand-navy">Interessados ({interessados.length})</h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {interessados.map((a) => {
              const p = a.profiles as unknown as { full_name: string; avatar_url: string | null } | null;
              const overall = overallFor(a.profile_id);
              return (
                <li
                  key={a.profile_id}
                  className="flex items-center gap-3 rounded-lg border border-gray-200 px-3 py-2.5"
                >
                  <Avatar src={p?.avatar_url} name={p?.full_name ?? "?"} size="sm" />
                  <span className="flex-1 truncate text-sm text-brand-navy">{p?.full_name}</span>
                  {overall !== null && <span className="text-xs text-gray-400">{overall.toFixed(1)}</span>}
                </li>
              );
            })}
            {!interessados.length && <li className="text-sm text-gray-500">Ninguém demonstrou interesse ainda.</li>}
          </ul>
        </section>
      )}
    </div>
  );
}
