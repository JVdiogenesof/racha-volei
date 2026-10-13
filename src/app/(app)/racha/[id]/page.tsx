import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarCheck, Users2, Trophy, PlayCircle, Award, Crown, Share2, Medal, MapPin, type LucideIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { EVENT_STATUS_LABELS } from "@/lib/eventStatus";
import { getRachaLevel } from "@/lib/rachaLevel";
import { ActionForm } from "@/components/ActionForm";
import { ToastFromQuery } from "@/components/ToastFromQuery";
import { RachaLevelBadge } from "@/components/RachaLevelBadge";
import { ConfirmedCounter } from "@/components/ConfirmedCounter";
import { EventProgress } from "@/components/EventProgress";
import { startEvent, finishEvent } from "./actions";
import { teamFormatLabel } from "@/lib/rachaFormat";
import { getActiveCommunity } from "@/lib/community";
import { getEventSummary } from "@/lib/eventSummary";
import { FinishEventCelebration } from "@/components/FinishEventCelebration";
import { RegistrationCountdown } from "@/components/RegistrationCountdown";
import { isRegistrationOpen } from "@/lib/registrationSchedule";

export default async function RachaHubPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireProfile();
  const supabase = await createClient();
  const community = await getActiveCommunity(profile);

  const [{ data: event }, { count: confirmedCount }, { count: interestedCount }, { data: myAttendance }, { data: finalMatch }] =
    await Promise.all([
      supabase
        .from("events")
        .select(
          "id, date, time, location, num_teams, team_size, price_per_player, status, official_list_open, max_players, is_pre_torneio, is_mini_torneio, community, registration_opens_at",
        )
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("attendance")
        .select("id", { count: "exact", head: true })
        .eq("event_id", id)
        .eq("status", "confirmed"),
      supabase
        .from("attendance")
        .select("id", { count: "exact", head: true })
        .eq("event_id", id)
        .eq("status", "interested"),
      supabase
        .from("attendance")
        .select("status")
        .eq("event_id", id)
        .eq("profile_id", profile.id)
        .maybeSingle(),
      supabase
        .from("tournament_matches")
        .select("id")
        .eq("event_id", id)
        .eq("stage", "final")
        .not("score_a", "is", null)
        .not("score_b", "is", null)
        .maybeSingle(),
    ]);

  if (!event) notFound();
  if (event.community !== community) notFound();

  const statusInfo = EVENT_STATUS_LABELS[event.status];
  const isFinished = event.status === "finished";
  const isCancelled = event.status === "cancelled";
  const isInProgress = event.status === "in_progress";
  const listOpen = event.official_list_open;
  const isTournament = event.is_pre_torneio || event.is_mini_torneio;
  const registrationOpen = isRegistrationOpen(event.registration_opens_at, event.official_list_open);
  const rachaLevel = listOpen ? await getRachaLevel(supabase, id) : null;
  const finishSummary = profile.is_organizer && isInProgress ? await getEventSummary(supabase, id) : null;
  const finishLeaders = finishSummary?.bestWinCount
    ? finishSummary.players.filter((player) => player.wins === finishSummary.bestWinCount).map((player) => player.fullName)
    : [];
  const myStatusLabel =
    myAttendance?.status === "confirmed"
      ? "confirmado"
      : myAttendance?.status === "interested"
        ? "interessado"
        : "de fora";

  const dateObj = new Date(`${event.date}T00:00:00`);

  return (
    <div className="space-y-3">
      <ToastFromQuery param="criado" message="Racha criado com sucesso!" />

      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-purple-300">Racha de {community === "sand" ? "areia" : "quadra"}</p>
          <h1 className="mt-0.5 text-2xl font-black capitalize text-white">
            {dateObj.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" }).replace(".", "")}
          </h1>
        </div>
        {statusInfo && (
          <span className={`mt-1 shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${statusInfo.className}`}>{statusInfo.label}</span>
        )}
      </header>

      <section className="grid gap-2.5 rounded-2xl border border-purple-300/20 bg-gradient-to-br from-[#51339a] via-[#2f205e] to-[#171136] p-3.5">
        {(event.is_pre_torneio || event.is_mini_torneio) && (
          <div className="flex flex-wrap gap-1.5">
            {event.is_pre_torneio && (
              <span className="flex items-center gap-1 rounded-full bg-amber-400/15 px-2.5 py-1 text-[11px] font-bold text-amber-200"><Award className="h-3 w-3" strokeWidth={2} />Pré-torneio · time vencedor garante vaga</span>
            )}
            {event.is_mini_torneio && (
              <span className="flex items-center gap-1 rounded-full bg-cyan-400/15 px-2.5 py-1 text-[11px] font-bold text-cyan-100"><Medal className="h-3 w-3" strokeWidth={2} />Mini torneio · todos contra todos</span>
            )}
          </div>
        )}
        <div className="grid grid-cols-3 gap-1.5 text-center">
          <div className="min-w-0 rounded-xl bg-black/15 px-1.5 py-2"><small className="block text-[9px] font-bold uppercase tracking-wide text-white/40">Horário</small><strong className="block truncate text-sm text-white">{event.time ? event.time.slice(0, 5) : "A definir"}</strong></div>
          <div className="min-w-0 rounded-xl bg-black/15 px-1.5 py-2"><small className="block text-[9px] font-bold uppercase tracking-wide text-white/40">Formato</small><strong className="block truncate text-sm text-white">{event.num_teams} times · {teamFormatLabel(event.team_size)}</strong></div>
          <div className="min-w-0 rounded-xl bg-black/15 px-1.5 py-2"><small className="block text-[9px] font-bold uppercase tracking-wide text-white/40">Valor</small><strong className="block truncate text-sm text-white">{event.price_per_player ? `R$ ${Number(event.price_per_player).toFixed(2)}` : "—"}</strong></div>
        </div>
        <p className="flex min-w-0 items-center gap-1.5 text-xs text-white/65"><MapPin className="h-3.5 w-3.5 shrink-0 text-purple-200" /><span className="truncate">{event.location ?? "Local a definir"}</span></p>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-full bg-white/12 px-2.5 py-1 text-[11px] font-bold text-purple-50">
            {listOpen ? `${confirmedCount ?? 0} confirmados` : `${interestedCount ?? 0} interessados`}
          </span>
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${myAttendance?.status === "confirmed" ? "bg-emerald-400/15 text-emerald-300" : myAttendance?.status === "interested" ? "bg-purple-300/15 text-purple-100" : "bg-white/10 text-white/60"}`}>
            Você está {myStatusLabel}
          </span>
          {rachaLevel !== null && <RachaLevelBadge level={rachaLevel} />}
        </div>
        {!isFinished && !isCancelled && registrationOpen && (
          <ConfirmedCounter
            eventId={id}
            maxPlayers={event.max_players}
            initialConfirmedCount={confirmedCount ?? 0}
          />
        )}
      </section>

      {!isFinished && !isCancelled && !registrationOpen && event.registration_opens_at && (
        <RegistrationCountdown opensAt={event.registration_opens_at} />
      )}

      <EventProgress
        status={event.status}
        officialListOpen={event.official_list_open}
        hasFinalResult={Boolean(finalMatch)}
        hasFinalStage={isTournament}
      />

      {profile.is_organizer && !isFinished && !isCancelled && (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-300/25 bg-amber-400/[0.07] px-3.5 py-2.5">
          <p className="text-xs leading-snug text-amber-50/85">
            {isInProgress
              ? "O racha está rolando. Termine o evento quando acabar pra liberar a escolha do Jogador Destaque."
              : listOpen
                ? "Quando a galera chegar ao local, inicie o evento."
                : "Publique a lista de confirmados (em \"Lista do racha\") antes de iniciar o evento."}
          </p>
          {isInProgress ? (
            <FinishEventCelebration eventId={id} confirmedCount={confirmedCount ?? 0} totalMatches={finishSummary?.totalMatches ?? 0} leaderNames={finishLeaders} action={finishEvent} />
          ) : listOpen ? (
            <ActionForm action={startEvent} successMessage="Racha iniciado!" className="ml-auto shrink-0">
              <input type="hidden" name="eventId" value={id} />
              <button className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-brand-purple px-3 text-sm font-bold text-white hover:bg-brand-purple-dark">
                <PlayCircle className="h-4 w-4" strokeWidth={2} />
                Iniciar evento
              </button>
            </ActionForm>
          ) : null}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <HubCard
          href={`/racha/${id}/confirmar`}
          icon={CalendarCheck}
          title="Lista do racha"
          description={listOpen ? `${confirmedCount ?? 0} confirmados` : "Diga se tem interesse em jogar."}
        />
        <HubCard
          href={`/racha/${id}/times`}
          icon={Users2}
          title="Times"
          description={listOpen ? "Veja ou gere os times." : "Libera com a lista publicada."}
        />
        {isTournament && finalMatch && (
          <HubCard
            href={`/racha/${id}/resultado`}
            icon={Crown}
            title="Resultado final"
            description={event.is_mini_torneio ? "Classificação do mini torneio." : "Campeão, vice, 3º e 4º lugar."}
          />
        )}
        {isFinished && (
          <HubCard
            href={`/racha/${id}/resumo`}
            icon={Share2}
            title="Resumo do racha"
            description="Quem mais venceu e arte do evento."
          />
        )}
        <HubCard
          href={`/racha/${id}/mvp`}
          icon={Trophy}
          title="Jogador Destaque"
          description={isFinished ? "Escolhido pelos organizadores." : "Libera quando o racha terminar."}
        />
      </div>
    </div>
  );
}

function HubCard({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group grid min-w-0 gap-2 rounded-2xl border border-white/10 bg-white/[0.035] p-3 transition hover:border-purple-300/40 hover:bg-white/[0.06]"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-400/15 text-purple-200 transition group-hover:bg-brand-purple group-hover:text-white">
        <Icon className="h-4.5 w-4.5" strokeWidth={2.25} />
      </span>
      <span className="min-w-0">
        <strong className="block text-[13px] font-bold text-white">{title}</strong>
        <span className="mt-0.5 block text-[11px] leading-snug text-white/50">{description}</span>
      </span>
    </Link>
  );
}
