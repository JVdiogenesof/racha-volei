import { notFound } from "next/navigation";
import { Check, X, Rocket, Undo2, ArrowLeftRight, Star, Phone, CircleDollarSign, ChevronDown, Settings2 } from "lucide-react";
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
import { QuickInviteReserveForm } from "@/components/QuickInviteReserveForm";
import { EndGuestAccessButton } from "@/components/EndGuestAccessButton";
import { ShareWhatsAppButton } from "@/components/ShareWhatsAppButton";
import { InterestButton } from "@/components/InterestButton";
import { CancelAttendanceButton } from "@/components/CancelAttendanceButton";
import { SetterBadge } from "@/components/SetterBadge";
import { CopyPixButton } from "@/components/CopyPixButton";
import { ConfirmedCounter } from "@/components/ConfirmedCounter";
import { ShareConfirmedListArtButton } from "@/components/ShareConfirmedListArtButton";
import { GuestRatingEditor } from "@/components/GuestRatingEditor";
import { OrganizerListDock } from "@/components/OrganizerListDock";
import { PIX_KEY } from "@/lib/payment";
import { setAttendance, setOfficialListOpen, setPaymentStatus, setEventSetterRole, promoteToConfirmed, demoteToInterested, removeAttendance } from "./actions";
import { inviteToEvent, endGuestAccess } from "@/app/(app)/admin/reserva/actions";
import { getActiveCommunity } from "@/lib/community";
import { isRegistrationOpen } from "@/lib/registrationSchedule";
import { RegistrationCountdown } from "@/components/RegistrationCountdown";
import { PixReservationButton } from "@/components/PixReservationButton";

export default async function ConfirmarPresencaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await requireProfile();
  const supabase = await createClient();
  const selectedCommunity = await getActiveCommunity(profile);

  const [{ data: event }, { data: attendanceList }, { data: myAttendance }, ratingsData, streaks, highlights, { data: paymentRows }, { data: setterOverrideRows }] =
    await Promise.all([
      supabase
        .from("events")
        .select("id, date, status, official_list_open, price_per_player, pix_payment_enabled, max_players, team_size, num_teams, newcomer_reserved_spots, community, registration_opens_at")
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("attendance")
        .select("profile_id, status, uses_newcomer_spot, profiles(full_name, avatar_url, is_setter)")
        .eq("event_id", id)
        .order("confirmed_at", { ascending: true }),
      supabase.from("attendance").select("status").eq("event_id", id).eq("profile_id", profile.id).maybeSingle(),
      profile.is_organizer
        ? Promise.all([getAllRatings(supabase), getRatingWeights(supabase)])
        : Promise.resolve(null),
      getAttendanceStreaks(supabase, selectedCommunity),
      getConfirmedHighlights(supabase, id),
      profile.is_organizer
        ? supabase.from("payments").select("profile_id, paid, payment_source").eq("event_id", id)
        : Promise.resolve({ data: null }),
      supabase.from("event_setter_overrides").select("profile_id, is_setter").eq("event_id", id),
    ]);

  const [{ data: approvedProfiles }, { data: reserveEntries }, { data: guestProfiles }] = profile.is_organizer
    ? await Promise.all([
        supabase.from("profiles").select("id, full_name").eq("status", "approved").contains("communities", [selectedCommunity]).order("full_name"),
        supabase.from("reserve_list").select("id, full_name").contains("communities", [selectedCommunity]).order("full_name"),
        supabase
          .from("profiles")
          .select("id, full_name, avatar_url, phone")
          .eq("status", "guest")
          .eq("guest_for_event_id", id)
          .order("full_name"),
      ])
    : [{ data: null }, { data: null }, { data: null }];

  if (!event) notFound();
  if (event.community !== selectedCommunity) notFound();

  const eventFinished = event.status === "finished";
  const eventCancelled = event.status === "cancelled";
  const listOpen = event.official_list_open;
  const registrationOpen = isRegistrationOpen(event.registration_opens_at, event.official_list_open);
  const dateLabel = new Date(`${event.date}T00:00:00`).toLocaleDateString("pt-BR");

  const confirmados = attendanceList?.filter((a) => a.status === "confirmed") ?? [];
  const newcomerConfirmedCount = confirmados.filter((attendance) => attendance.uses_newcomer_spot).length;
  const regularConfirmedCount = confirmados.length - newcomerConfirmedCount;
  const eventCapacity = event.max_players ?? event.num_teams * event.team_size;
  const memberCapacity = Math.max(0, eventCapacity - event.newcomer_reserved_spots);
  const regularSlotsRemaining = Math.max(
    0,
    memberCapacity - regularConfirmedCount,
  );
  const isFull =
    profile.status === "guest"
      ? confirmados.length >= eventCapacity
      : regularConfirmedCount >= memberCapacity;
  const interessados = attendanceList?.filter((a) => a.status === "interested") ?? [];
  const confirmedIds = new Set(confirmados.map((a) => a.profile_id));
  const addDirectOptions = (approvedProfiles ?? [])
    .filter((p) => !confirmedIds.has(p.id))
    .filter(() => regularSlotsRemaining > 0)
    .map((p) => ({ id: p.id, fullName: p.full_name }));
  const reserveOptions = (reserveEntries ?? []).map((p) => ({ id: p.id, fullName: p.full_name }));
  const convidados = (guestProfiles ?? []).filter((guest) => !confirmedIds.has(guest.id));
  const paidProfileIds = new Set((paymentRows ?? []).filter((payment) => payment.paid).map((payment) => payment.profile_id));
  const paymentSourceByProfile = new Map((paymentRows ?? []).filter((payment) => payment.paid).map((payment) => [payment.profile_id, payment.payment_source]));
  const paidConfirmedCount = confirmados.filter((attendance) => paidProfileIds.has(attendance.profile_id)).length;
  const setterOverrides = new Map((setterOverrideRows ?? []).map((row) => [row.profile_id, row.is_setter]));

  function isSetterForEvent(attendance: (typeof confirmados)[number]) {
    const profileRow = attendance.profiles as unknown as { is_setter: boolean } | null;
    return setterOverrides.get(attendance.profile_id) ?? profileRow?.is_setter ?? false;
  }

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

  function ratingDetailsFor(profileId: string) {
    if (!ratingsData) return { provisional: false, initialRatings: {} };
    const [{ selfByProfile, organizerByProfile }] = ratingsData;
    const organizerRatings = organizerByProfile.get(profileId) ?? {};
    const provisional = Object.keys(organizerRatings).length === 0;
    return {
      provisional,
      initialRatings: provisional ? (selfByProfile.get(profileId) ?? {}) : organizerRatings,
    };
  }

  const confirmadosOrdenados = ratingsData
    ? [...confirmados].sort((a, b) => (overallFor(b.profile_id) ?? 0) - (overallFor(a.profile_id) ?? 0))
    : confirmados;

  const shareText = [
    `🏐 Lista de presença do racha de ${dateLabel} — confirmados (${confirmados.length}):`,
    "",
    ...confirmados.map((a, i) => {
      const p = a.profiles as unknown as { full_name: string; is_setter: boolean } | null;
      const name = p?.full_name ?? "?";
      const isSetter = isSetterForEvent(a);
      const labels = [isSetter ? "🏐 levantador(a)" : null, a.uses_newcomer_spot ? "*CONVIDADO*" : null].filter(Boolean);
      return `${i + 1}. ${isSetter ? `*${name}*` : name}${labels.length > 0 ? ` · ${labels.join(" · ")}` : ""}`;
    }),
  ].join("\n");

  const myStatus = myAttendance?.status;
  const canRespond =
    profile.status === "approved" ||
    (profile.status === "guest" && profile.guest_for_event_id === id);
  const statusLabel =
    !canRespond
      ? "Modo visitante"
      : !registrationOpen
        ? "Inscrições em breve"
      : myStatus === "confirmed"
      ? "Confirmado"
      : myStatus === "interested"
        ? "Interesse marcado"
        : myStatus === "declined"
          ? "Não vai"
          : "Ainda não respondeu";
  const canSeeConfirmados = listOpen || profile.is_organizer;

  return (
    <div className={`space-y-4 ${profile.is_organizer ? "pb-40" : ""}`}>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold text-white">Lista do racha</h1>
          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold text-white/65">{dateLabel}</span>
          <span className="rounded-full border border-purple-300/20 bg-purple-400/10 px-2.5 py-1 text-xs font-semibold text-purple-100">{statusLabel}</span>
        </div>
        {!eventCancelled && !eventFinished && (
          <p className="mt-1.5 text-sm text-white/50">Marque seu interesse. A confirmação final é feita pelos organizadores.</p>
        )}
      </div>

      {!registrationOpen && event.registration_opens_at && !eventFinished && !eventCancelled && (
        <RegistrationCountdown opensAt={event.registration_opens_at} />
      )}

      {!eventFinished && !eventCancelled && (
        <ConfirmedCounter
          eventId={id}
          maxPlayers={eventCapacity}
          initialConfirmedCount={confirmados.length}
        />
      )}

      {!eventFinished && !eventCancelled && highlights.topOverall.length > 0 && (
        <details className="group rounded-xl border border-brand-purple/25 bg-gradient-to-br from-brand-purple/10 to-transparent">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3.5 py-2.5 text-sm font-semibold text-white">
            <Star className="h-4 w-4 text-purple-300" strokeWidth={2} />
            Destaques dos confirmados
            <span className="ml-auto text-xs font-normal text-white/40">{highlights.topOverall.length + highlights.topSetters.length}</span>
            <ChevronDown className="h-4 w-4 text-white/45 transition group-open:rotate-180" />
          </summary>
          <div className="border-t border-white/8 px-3.5 pb-3.5 pt-3">
            <div className="flex flex-wrap gap-2">
            {highlights.topOverall.map((h) => (
              <div
                key={h.profileId}
                className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2"
              >
                <Avatar src={h.avatarUrl} name={h.fullName} size="sm" />
                <p className="min-w-0 truncate text-sm font-medium text-white">{h.fullName}</p>
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
                    <p className="min-w-0 truncate text-sm font-medium text-white">{h.fullName}</p>
                  </div>
                ))}
              </div>
              </>
            )}
          </div>
        </details>
      )}

      {!canRespond && !eventFinished && !eventCancelled ? (
        <p className="rounded-xl border border-amber-300/25 bg-amber-400/10 px-4 py-4 text-sm text-amber-100">
          Você pode acompanhar a lista. Para responder ou entrar neste racha, aguarde o convite de um organizador.
        </p>
      ) : eventCancelled ? (
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
      ) : !registrationOpen ? (
        <p className="rounded-xl border border-fuchsia-300/20 bg-fuchsia-400/10 px-4 py-4 text-center text-sm text-fuchsia-100/80">
          A inscrição ainda está fechada. O botão para colocar seu nome aparecerá automaticamente quando o cronômetro zerar.
        </p>
      ) : (
        <div className="flex gap-3">
          {event.pix_payment_enabled && event.price_per_player ? (
            <PixReservationButton eventId={id} hasInterest={myStatus === "interested"} isFull={isFull} action={setAttendance} />
          ) : (
            <InterestButton
              eventId={id}
              price={event.price_per_player ? Number(event.price_per_player) : null}
              isFull={isFull}
              action={setAttendance}
            />
          )}
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

      {canRespond && registrationOpen && !eventFinished && !eventCancelled && event.price_per_player && !event.pix_payment_enabled && myStatus !== "confirmed" && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
          <p className="text-sm text-white/70">
            💰 Pagamento de <strong>R$ {Number(event.price_per_player).toFixed(2)}</strong> via Pix:{" "}
            <span className="font-medium text-white">{PIX_KEY}</span>
          </p>
          <CopyPixButton pixKey={PIX_KEY} className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/10" />
        </div>
      )}

      {profile.is_organizer && (
        <OrganizerListDock
          summary={`${confirmados.length} confirmados · ${interessados.length} interessados · ${listOpen ? "pública" : "privada"}`}
          peopleCount={addDirectOptions.length + reserveOptions.length + convidados.length}
          controls={
            <>
              {!eventFinished && !eventCancelled && (
                listOpen ? (
                  <ActionForm action={setOfficialListOpen} successMessage="Lista de confirmados escondida de novo.">
                    <input type="hidden" name="eventId" value={id} />
                    <input type="hidden" name="open" value="false" />
                    <button
                      type="submit"
                      aria-label="Esconder lista de confirmados"
                      title="Esconder lista de confirmados"
                      className="flex h-11 w-11 items-center justify-center rounded-full border border-white/12 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white"
                    >
                      <Undo2 className="h-5 w-5" strokeWidth={2} />
                    </button>
                  </ActionForm>
                ) : (
                  <ActionForm action={setOfficialListOpen} successMessage="Lista de confirmados publicada!">
                    <input type="hidden" name="eventId" value={id} />
                    <input type="hidden" name="open" value="true" />
                    <button
                      type="submit"
                      aria-label="Publicar lista de confirmados"
                      title="Publicar lista de confirmados"
                      className="flex h-11 w-11 items-center justify-center rounded-full border border-indigo-300/25 bg-brand-navy text-white transition hover:bg-brand-navy-light"
                    >
                      <Rocket className="h-5 w-5" strokeWidth={2} />
                    </button>
                  </ActionForm>
                )
              )}
              {listOpen && (
                <ShareWhatsAppButton
                  text={shareText}
                  iconOnly
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-green-400/25 bg-green-500/15 text-green-300 transition hover:bg-green-500/25"
                />
              )}
              {listOpen && !eventCancelled && confirmados.length > 0 && (
                <ShareConfirmedListArtButton eventId={id} eventDate={event.date} compact />
              )}
            </>
          }
        >
          {!eventFinished && !eventCancelled && (
            <>
              <AddDirectToConfirmedForm action={promoteToConfirmed} eventId={id} players={addDirectOptions} />
              <QuickInviteReserveForm action={inviteToEvent} eventId={id} people={reserveOptions} />
            </>
          )}

          {convidados.length > 0 && (
            <section className="rounded-xl border border-white/10 bg-white/[0.025] p-3.5">
              <h3 className="font-semibold text-white">Convidados chamados ({convidados.length})</h3>
              <p className="mt-0.5 text-xs text-white/40">Ainda não estão entre os confirmados.</p>
              <ul className="mt-3 grid gap-2">
                {convidados.map((g) => (
                  <li key={g.id} className="flex min-w-0 flex-wrap items-center gap-2 rounded-lg border border-white/10 px-3 py-2.5">
                    <Avatar src={g.avatar_url} name={g.full_name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-white">{g.full_name}</p>
                      {g.phone && (
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-white/40">
                          <Phone className="h-3 w-3" strokeWidth={2} />
                          {g.phone}
                        </p>
                      )}
                    </div>
                    {!eventFinished && !eventCancelled && (
                      <ActionForm action={promoteToConfirmed} successMessage={`${g.full_name} confirmado(a)!`}>
                        <input type="hidden" name="eventId" value={id} />
                        <input type="hidden" name="profileId" value={g.id} />
                        <button type="submit" className="inline-flex items-center gap-1 rounded-lg bg-brand-purple px-2.5 py-1.5 text-xs font-medium text-white hover:bg-brand-purple-dark">
                          <Check className="h-3 w-3" strokeWidth={2} />
                          Confirmar
                        </button>
                      </ActionForm>
                    )}
                    <EndGuestAccessButton profileId={g.id} fullName={g.full_name} action={endGuestAccess} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </OrganizerListDock>
      )}

      {canSeeConfirmados && (
        <section>
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h2 className="font-semibold text-white">
              Confirmados ({confirmados.length})
              {!listOpen && profile.is_organizer && <span className="ml-2 text-xs font-normal text-white/40">(ainda privado)</span>}
            </h2>
            {profile.is_organizer && (
              <p className="text-xs text-white/50">
                <span className="font-semibold text-green-300">{paidConfirmedCount} pagos</span>
                {" · "}{confirmados.length - paidConfirmedCount} pendentes
              </p>
            )}
          </div>
          <ul className="mt-2.5 grid gap-2 sm:grid-cols-2">
            {confirmadosOrdenados.map((a) => {
              const p = a.profiles as unknown as { full_name: string; avatar_url: string | null; is_setter: boolean } | null;
              const overall = overallFor(a.profile_id);
              const hasPaid = paidProfileIds.has(a.profile_id);
              const paymentSource = paymentSourceByProfile.get(a.profile_id);
              const isSetter = isSetterForEvent(a);
              const ratingDetails = ratingDetailsFor(a.profile_id);
              const hasProvisionalGuestRating = a.uses_newcomer_spot && ratingDetails.provisional;
              return (
                <li
                  key={a.profile_id}
                  className="min-w-0 rounded-xl border border-white/10 bg-white/[0.025] p-3"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <Avatar src={p?.avatar_url} name={p?.full_name ?? "?"} size="sm" streak={streaks.get(a.profile_id)} />
                    <div className="min-w-0 flex-1 pt-0.5">
                      <p className={`truncate text-[15px] text-white ${a.uses_newcomer_spot ? "font-bold" : "font-semibold"}`}>{p?.full_name}</p>
                      <div className="mt-1.5 flex min-h-5 flex-wrap items-center gap-1.5">
                        {a.uses_newcomer_spot && (
                          <span className="inline-flex rounded-full border border-cyan-300/25 bg-cyan-400/10 px-2 py-0.5 text-[10px] font-black tracking-wide text-cyan-200">
                            CONVIDADO
                          </span>
                        )}
                        {isSetter && <SetterBadge />}
                        {profile.is_organizer && (
                          <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wide ${hasPaid ? "border-green-400/25 bg-green-500/10 text-green-300" : "border-white/10 bg-white/5 text-white/40"}`}>
                            {hasPaid ? paymentSource === "balance" ? "PAGO · SALDO" : "PAGO" : "PENDENTE"}
                          </span>
                        )}
                        {hasProvisionalGuestRating && (
                          <span className="inline-flex rounded-full border border-amber-300/25 bg-amber-400/10 px-2 py-0.5 text-[10px] font-black tracking-wide text-amber-200">
                            NOTA PROVISÓRIA
                          </span>
                        )}
                      </div>
                    </div>
                    {overall !== null && (
                      <span className={`shrink-0 rounded-full border px-2 py-1 text-[11px] font-semibold ${hasProvisionalGuestRating ? "border-amber-300/20 bg-amber-400/10 text-amber-200" : "border-white/10 bg-white/5 text-white/55"}`}>
                        Nota {overall.toFixed(1)}
                      </span>
                    )}
                  </div>
                  {profile.is_organizer && a.uses_newcomer_spot && (
                    <GuestRatingEditor
                      eventId={id}
                      profileId={a.profile_id}
                      fullName={p?.full_name ?? "Convidado"}
                      initialRatings={ratingDetails.initialRatings}
                      provisional={ratingDetails.provisional}
                    />
                  )}
                  {profile.is_organizer && (
                    <details className="group mt-2 border-t border-white/8">
                      <summary className="flex min-h-9 cursor-pointer list-none items-center justify-end gap-1.5 pt-2 text-xs font-medium text-white/45 hover:text-white/75">
                        <Settings2 className="h-3.5 w-3.5" />
                        Gerenciar
                        <ChevronDown className="h-3.5 w-3.5 transition group-open:rotate-180" />
                      </summary>
                      <div className="grid grid-cols-2 gap-2 pb-0.5 pt-2 sm:flex sm:items-center sm:justify-end">
                      {!eventFinished && !eventCancelled && (
                        <ActionForm
                          action={setEventSetterRole}
                          successMessage={isSetter ? `${p?.full_name ?? "Jogador"} não será levantador(a) neste racha.` : `${p?.full_name ?? "Jogador"} será levantador(a) neste racha.`}
                          className="min-w-0 sm:shrink-0"
                        >
                          <input type="hidden" name="eventId" value={id} />
                          <input type="hidden" name="profileId" value={a.profile_id} />
                          <input type="hidden" name="isSetter" value={isSetter ? "false" : "true"} />
                          <button
                            type="submit"
                            aria-label={isSetter ? `Desmarcar ${p?.full_name ?? "jogador"} como levantador` : `Marcar ${p?.full_name ?? "jogador"} como levantador`}
                            title={isSetter ? "Desmarcar levantador neste racha" : "Marcar levantador neste racha"}
                            className={`flex h-10 w-full items-center justify-center gap-1.5 rounded-lg border px-2 text-xs font-medium transition sm:h-9 sm:w-9 sm:rounded-full sm:px-0 ${
                              isSetter
                                ? "border-purple-300/40 bg-purple-400/20 text-purple-100"
                                : "border-white/10 bg-white/5 text-white/55 hover:border-purple-300/30 hover:bg-purple-400/10 hover:text-purple-200"
                            }`}
                          >
                            <span>🏐</span>
                            <span className="sm:hidden">{isSetter ? "Tirar levant." : "Marcar levant."}</span>
                          </button>
                        </ActionForm>
                      )}
                      <ActionForm
                        action={setPaymentStatus}
                        successMessage={hasPaid ? `${p?.full_name ?? "Jogador"}: pagamento desmarcado.` : `${p?.full_name ?? "Jogador"}: pagamento confirmado!`}
                        className="min-w-0 sm:shrink-0"
                      >
                        <input type="hidden" name="eventId" value={id} />
                        <input type="hidden" name="profileId" value={a.profile_id} />
                        <input type="hidden" name="paid" value={hasPaid ? "false" : "true"} />
                        <button
                          type="submit"
                          aria-label={hasPaid ? `Desmarcar pagamento de ${p?.full_name ?? "jogador"}` : `Marcar pagamento de ${p?.full_name ?? "jogador"}`}
                          title={hasPaid ? "Pago — clique para desmarcar" : "Pendente — clique para marcar como pago"}
                          className={`flex h-10 w-full items-center justify-center gap-1.5 rounded-lg border px-2 text-xs font-medium transition sm:h-9 sm:w-9 sm:rounded-full sm:px-0 ${
                            hasPaid
                              ? "border-green-400/40 bg-green-500/20 text-green-300 shadow-sm shadow-green-950/40"
                              : "border-white/10 bg-white/5 text-white/55 hover:border-green-400/30 hover:bg-green-500/10 hover:text-green-300"
                          }`}
                        >
                          <CircleDollarSign className="h-4 w-4" strokeWidth={hasPaid ? 2.5 : 2} />
                          <span className="sm:hidden">{hasPaid ? "Pago" : "Pendente"}</span>
                        </button>
                      </ActionForm>
                      {!eventFinished && !eventCancelled && (
                        <ActionForm action={demoteToInterested} successMessage="Voltou pra interessados." className="min-w-0 sm:shrink-0">
                          <input type="hidden" name="eventId" value={id} />
                          <input type="hidden" name="profileId" value={a.profile_id} />
                          <button
                            type="submit"
                            aria-label="Voltar pra interessados"
                            title="Voltar pra interessados"
                            className="flex h-10 w-full items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2 text-xs font-medium text-white/60 hover:bg-white/10 hover:text-white sm:h-9 sm:w-9 sm:rounded-full sm:px-0"
                          >
                            <ArrowLeftRight className="h-3.5 w-3.5" strokeWidth={2} />
                            <span className="sm:hidden">Interessados</span>
                          </button>
                        </ActionForm>
                      )}
                      <div className="min-w-0 sm:shrink-0">
                        <RemoveAttendanceButton
                          eventId={id}
                          profileId={a.profile_id}
                          fullName={p?.full_name ?? "esse jogador"}
                          action={removeAttendance}
                          showMobileLabel
                        />
                      </div>
                      </div>
                    </details>
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
                className="flex min-w-0 items-center gap-2 rounded-lg border border-white/10 px-3 py-2.5"
              >
                <Avatar src={p?.avatar_url} name={p?.full_name ?? "?"} size="sm" />
                <span className="min-w-0 flex-1 truncate text-sm text-white">{p?.full_name}</span>
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
