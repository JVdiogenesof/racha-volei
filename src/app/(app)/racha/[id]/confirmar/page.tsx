import { notFound } from "next/navigation";
import { Check, X, Rocket, Undo2, ArrowLeftRight, Star } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { getAllRatings, getRatingWeights } from "@/lib/ratings";
import { finalScoresForPlayer, overallScore } from "@/lib/scoring";
import { getAttendanceStreaks } from "@/lib/streak";
import { getConfirmedHighlights } from "@/lib/highlights";
import { Avatar } from "@/components/Avatar";
import { ActionForm } from "@/components/ActionForm";
import { RemoveAttendanceButton } from "@/components/RemoveAttendanceButton";
import { AddDirectToConfirmedForm } from "@/components/AddDirectToConfirmedForm";
import { ShareWhatsAppButton } from "@/components/ShareWhatsAppButton";
import { InterestButton } from "@/components/InterestButton";
import { CancelAttendanceButton } from "@/components/CancelAttendanceButton";
import { SetterBadge } from "@/components/SetterBadge";
import { CopyPixButton } from "@/components/CopyPixButton";
import { ConfirmedCounter } from "@/components/ConfirmedCounter";
import { PIX_KEY } from "@/lib/payment";
import { setAttendance, setOfficialListOpen, promoteToConfirmed, demoteToInterested, removeAttendance } from "./actions";

export default async function ConfirmarPresencaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await requireProfile();
  const supabase = await createClient();

  const [{ data: event }, { data: attendanceList }, { data: myAttendance }, ratingsData, streaks, highlights] =
    await Promise.all([
      supabase
        .from("events")
        .select("id, date, status, official_list_open, price_per_player, max_players")
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("attendance")
        .select("profile_id, status, profiles(full_name, avatar_url, is_setter)")
        .eq("event_id", id)
        .order("confirmed_at", { ascending: true }),
      supabase.from("attendance").select("status").eq("event_id", id).eq("profile_id", profile.id).maybeSingle(),
      profile.is_organizer
        ? Promise.all([getAllRatings(supabase), getRatingWeights(supabase)])
        : Promise.resolve(null),
      getAttendanceStreaks(supabase),
      getConfirmedHighlights(supabase, id),
    ]);

  const { data: approvedProfiles } = profile.is_organizer
    ? await supabase.from("profiles").select("id, full_name").eq("status", "approved").order("full_name")
    : { data: null };

  if (!event) notFound();

  const eventFinished = event.status === "finished";
  const eventCancelled = event.status === "cancelled";
  const listOpen = event.official_list_open;
  const dateLabel = new Date(`${event.date}T00:00:00`).toLocaleDateString("pt-BR");

  const confirmados = attendanceList?.filter((a) => a.status === "confirmed") ?? [];
  const isFull = event.max_players != null && confirmados.length >= event.max_players;
  const interessados = attendanceList?.filter((a) => a.status === "interested") ?? [];
  const confirmedIds = new Set(confirmados.map((a) => a.profile_id));
  const addDirectOptions = (approvedProfiles ?? [])
    .filter((p) => !confirmedIds.has(p.id))
    .map((p) => ({ id: p.id, fullName: p.full_name }));

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

  const shareText = [
    `🏐 Lista de presença do racha de ${dateLabel} — confirmados (${confirmados.length}):`,
    "",
    ...confirmados.map((a, i) => {
      const p = a.profiles as unknown as { full_name: string; is_setter: boolean } | null;
      const name = p?.full_name ?? "?";
      return `${i + 1}. ${p?.is_setter ? `*${name}* 🏐 (levantador)` : name}`;
    }),
  ].join("\n");

  const myStatus = myAttendance?.status;
  const statusLabel =
    myStatus === "confirmed"
      ? "Confirmado"
      : myStatus === "interested"
        ? "Interesse marcado"
        : myStatus === "declined"
          ? "Não vai"
          : "Ainda não respondeu";
  const canSeeConfirmados = listOpen || profile.is_organizer;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Lista do racha · {dateLabel}</h1>
        {!eventCancelled && !eventFinished && (
          <p className="mt-1 text-sm text-white/60">
            Marque que tem interesse. Os organizadores confirmam manualmente quem entra na lista
            oficial{listOpen ? "" : ", que ainda não foi publicada"}.
          </p>
        )}
        <p className="mt-1 text-sm text-white/60">
          Situação atual: <strong>{statusLabel}</strong>
        </p>
      </div>

      {!eventFinished && !eventCancelled && (
        <ConfirmedCounter
          eventId={id}
          maxPlayers={event.max_players}
          initialConfirmedCount={confirmados.length}
        />
      )}

      {!eventFinished && !eventCancelled && highlights.topOverall.length > 0 && (
        <section className="rounded-xl border border-brand-purple/30 bg-gradient-to-br from-brand-purple/15 to-transparent p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
            <Star className="h-4 w-4 text-purple-300" strokeWidth={2} />
            Quem já confirmou
          </h3>
          <p className="mt-0.5 text-xs text-white/50">Alguns dos melhores já garantiram presença</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {highlights.topOverall.map((h) => (
              <div
                key={h.profileId}
                className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2"
              >
                <Avatar src={h.avatarUrl} name={h.fullName} size="sm" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">{h.fullName}</p>
                  <p className="flex items-center gap-1 text-xs text-white/50">
                    <Star className="h-3 w-3 fill-current" strokeWidth={0} />
                    {h.overall.toFixed(1)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {highlights.topSetters.length > 0 && (
            <>
              <p className="mt-3 text-xs font-medium text-white/60">Levantadores confirmados</p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {highlights.topSetters.map((h) => (
                  <div
                    key={h.profileId}
                    className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2"
                  >
                    <Avatar src={h.avatarUrl} name={h.fullName} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">{h.fullName}</p>
                      <p className="flex items-center gap-1 text-xs text-white/50">
                        <Star className="h-3 w-3 fill-current" strokeWidth={0} />
                        {h.overall.toFixed(1)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {eventCancelled ? (
        <p className="rounded-xl border border-orange-500/30 bg-orange-500/15 px-4 py-4 text-sm text-orange-300">
          Esse racha foi cancelado — não dá mais pra responder.
        </p>
      ) : eventFinished ? (
        <p className="rounded-xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/60">
          Esse racha já terminou — não dá mais pra responder.
        </p>
      ) : myStatus === "confirmed" ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-green-500/30 bg-green-500/15 px-4 py-3">
          <p className="text-sm text-green-300">🎉 Você está confirmado(a) pra esse racha!</p>
          <CancelAttendanceButton
            eventId={id}
            action={setAttendance}
            className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm font-medium text-white/70 hover:bg-white/10 disabled:opacity-50"
          />
        </div>
      ) : (
        <div className="flex gap-3">
          <InterestButton
            eventId={id}
            price={event.price_per_player ? Number(event.price_per_player) : null}
            isFull={isFull}
            action={setAttendance}
          />
          <ActionForm action={setAttendance} successMessage="Você marcou que não vai.">
            <input type="hidden" name="eventId" value={id} />
            <input type="hidden" name="status" value="declined" />
            <button className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-4 py-2 font-medium text-white/70 hover:bg-white/5">
              <X className="h-4 w-4" strokeWidth={2} />
              Não vou
            </button>
          </ActionForm>
        </div>
      )}

      {!eventFinished && !eventCancelled && event.price_per_player && myStatus !== "confirmed" && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
          <p className="text-sm text-white/70">
            💰 Pagamento de <strong>R$ {Number(event.price_per_player).toFixed(2)}</strong> via Pix:{" "}
            <span className="font-medium text-white">{PIX_KEY}</span>
          </p>
          <CopyPixButton pixKey={PIX_KEY} className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/10" />
        </div>
      )}

      {profile.is_organizer && !eventFinished && !eventCancelled && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
          <p className="text-sm text-white/70">
            {confirmados.length} confirmados · {interessados.length} interessados
            {listOpen ? " · lista pública" : " · lista ainda privada"}
          </p>
          {listOpen && <ShareWhatsAppButton text={shareText} />}
          {listOpen ? (
            <ActionForm
              action={setOfficialListOpen}
              successMessage="Lista de confirmados escondida de novo."
              className="ml-auto shrink-0"
            >
              <input type="hidden" name="eventId" value={id} />
              <input type="hidden" name="open" value="false" />
              <button className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm font-medium text-white/70 hover:bg-white/10">
                <Undo2 className="h-4 w-4" strokeWidth={2} />
                Esconder lista de confirmados
              </button>
            </ActionForm>
          ) : (
            <ActionForm
              action={setOfficialListOpen}
              successMessage="Lista de confirmados publicada!"
              className="ml-auto shrink-0"
            >
              <input type="hidden" name="eventId" value={id} />
              <input type="hidden" name="open" value="true" />
              <button className="inline-flex items-center gap-1.5 rounded-lg bg-brand-navy px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-navy-light">
                <Rocket className="h-4 w-4" strokeWidth={2} />
                Publicar lista de confirmados
              </button>
            </ActionForm>
          )}
        </div>
      )}

      {profile.is_organizer && !eventFinished && !eventCancelled && (
        <AddDirectToConfirmedForm action={promoteToConfirmed} eventId={id} players={addDirectOptions} />
      )}

      {canSeeConfirmados && (
        <section>
          <h2 className="font-semibold text-white">
            Confirmados ({confirmados.length})
            {!listOpen && profile.is_organizer && <span className="ml-2 text-xs font-normal text-white/40">(ainda privado)</span>}
          </h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {confirmados.map((a) => {
              const p = a.profiles as unknown as { full_name: string; avatar_url: string | null; is_setter: boolean } | null;
              return (
                <li
                  key={a.profile_id}
                  className="flex items-center gap-3 rounded-lg border border-white/10 px-3 py-2.5"
                >
                  <Avatar src={p?.avatar_url} name={p?.full_name ?? "?"} size="sm" streak={streaks.get(a.profile_id)} />
                  <span className="flex-1 truncate text-sm text-white">{p?.full_name}</span>
                  {p?.is_setter && <SetterBadge />}
                  {profile.is_organizer && !eventFinished && !eventCancelled && (
                    <ActionForm action={demoteToInterested} successMessage="Voltou pra interessados.">
                      <input type="hidden" name="eventId" value={id} />
                      <input type="hidden" name="profileId" value={a.profile_id} />
                      <button
                        type="submit"
                        aria-label="Voltar pra interessados"
                        className="flex h-7 w-7 items-center justify-center rounded-full text-white/40 hover:bg-white/10 hover:text-white/70"
                      >
                        <ArrowLeftRight className="h-3.5 w-3.5" strokeWidth={2} />
                      </button>
                    </ActionForm>
                  )}
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
            {!confirmados.length && <li className="text-sm text-white/60">Ninguém confirmado ainda.</li>}
          </ul>
        </section>
      )}

      <section>
        <h2 className="font-semibold text-white">Interessados ({interessados.length})</h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {interessados.map((a) => {
            const p = a.profiles as unknown as { full_name: string; avatar_url: string | null; is_setter: boolean } | null;
            const overall = overallFor(a.profile_id);
            return (
              <li
                key={a.profile_id}
                className="flex items-center gap-3 rounded-lg border border-white/10 px-3 py-2.5"
              >
                <Avatar src={p?.avatar_url} name={p?.full_name ?? "?"} size="sm" />
                <span className="flex-1 truncate text-sm text-white">{p?.full_name}</span>
                {p?.is_setter && <SetterBadge />}
                {overall !== null && <span className="text-xs text-white/40">{overall.toFixed(1)}</span>}
                {profile.is_organizer && !eventFinished && !eventCancelled && (
                  <ActionForm action={promoteToConfirmed} successMessage={`${p?.full_name ?? "Jogador"} confirmado!`}>
                    <input type="hidden" name="eventId" value={id} />
                    <input type="hidden" name="profileId" value={a.profile_id} />
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1 rounded-lg bg-brand-purple px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-purple-dark"
                    >
                      <Check className="h-3 w-3" strokeWidth={2} />
                      Confirmar
                    </button>
                  </ActionForm>
                )}
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
          {!interessados.length && <li className="text-sm text-white/60">Ninguém demonstrou interesse ainda.</li>}
        </ul>
      </section>
    </div>
  );
}
