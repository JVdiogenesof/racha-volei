import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarCheck, Users2, Trophy, PlayCircle, StopCircle, Award, type LucideIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { EVENT_STATUS_LABELS } from "@/lib/eventStatus";
import { getRachaLevel } from "@/lib/rachaLevel";
import { ActionForm } from "@/components/ActionForm";
import { ToastFromQuery } from "@/components/ToastFromQuery";
import { RachaLevelBadge } from "@/components/RachaLevelBadge";
import { ConfirmedCounter } from "@/components/ConfirmedCounter";
import { startEvent, finishEvent } from "./actions";

export default async function RachaHubPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireProfile();
  const supabase = await createClient();

  const [{ data: event }, { count: confirmedCount }, { count: interestedCount }, { data: myAttendance }] =
    await Promise.all([
      supabase
        .from("events")
        .select(
          "id, date, time, location, num_teams, price_per_player, status, official_list_open, max_players, is_pre_torneio",
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
    ]);

  if (!event) notFound();

  const statusInfo = EVENT_STATUS_LABELS[event.status];
  const isFinished = event.status === "finished";
  const isInProgress = event.status === "in_progress";
  const listOpen = event.official_list_open;
  const rachaLevel = listOpen ? await getRachaLevel(supabase, id) : null;
  const myStatusLabel =
    myAttendance?.status === "confirmed"
      ? "confirmado"
      : myAttendance?.status === "interested"
        ? "interessado"
        : "de fora";

  return (
    <div className="space-y-6">
      <ToastFromQuery param="criado" message="Racha criado com sucesso!" />

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold text-white">
            Racha de {new Date(`${event.date}T00:00:00`).toLocaleDateString("pt-BR")}
          </h1>
          {statusInfo && (
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusInfo.className}`}>
              {statusInfo.label}
            </span>
          )}
          {event.is_pre_torneio && (
            <span className="flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-300">
              <Award className="h-3 w-3" strokeWidth={2} />
              Pré-torneio · time vencedor garante vaga
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-white/60">
          {event.location ?? "Local a definir"}
          {event.time ? ` · ${event.time.slice(0, 5)}` : ""} · {event.num_teams} times
          {event.price_per_player ? ` · R$ ${Number(event.price_per_player).toFixed(2)} por jogador` : ""}
        </p>
        <p className="mt-1 text-sm text-white/60">
          {listOpen
            ? `${confirmedCount ?? 0} confirmados`
            : `${interestedCount ?? 0} interessados`}{" "}
          · você está <strong>{myStatusLabel}</strong>
        </p>
        {rachaLevel !== null && (
          <div className="mt-2">
            <RachaLevelBadge level={rachaLevel} />
          </div>
        )}
        {!isFinished && (
          <div className="mt-3">
            <ConfirmedCounter
              eventId={id}
              maxPlayers={event.max_players}
              initialConfirmedCount={confirmedCount ?? 0}
            />
          </div>
        )}
      </div>

      {profile.is_organizer && !isFinished && (
        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
          <p className="text-sm text-white/70">
            {isInProgress
              ? "O racha está rolando. Termine o evento quando acabar pra liberar a escolha do Jogador Destaque."
              : listOpen
                ? "Quando a galera chegar na quadra, inicie o evento."
                : "Publique a lista de confirmados (em \"Lista do racha\") antes de iniciar o evento."}
          </p>
          {isInProgress ? (
            <ActionForm action={finishEvent} successMessage="Racha finalizado! Agora os organizadores podem escolher o Jogador Destaque." className="ml-auto shrink-0">
              <input type="hidden" name="eventId" value={id} />
              <button className="inline-flex items-center gap-1.5 rounded-lg bg-brand-navy px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-navy-light">
                <StopCircle className="h-4 w-4" strokeWidth={2} />
                Terminar evento
              </button>
            </ActionForm>
          ) : listOpen ? (
            <ActionForm action={startEvent} successMessage="Racha iniciado!" className="ml-auto shrink-0">
              <input type="hidden" name="eventId" value={id} />
              <button className="inline-flex items-center gap-1.5 rounded-lg bg-brand-purple px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-purple-dark">
                <PlayCircle className="h-4 w-4" strokeWidth={2} />
                Iniciar evento
              </button>
            </ActionForm>
          ) : null}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <HubCard
          href={`/racha/${id}/confirmar`}
          icon={CalendarCheck}
          title="Lista do racha"
          description="Diga se você tem interesse em jogar."
        />
        <HubCard
          href={`/racha/${id}/times`}
          icon={Users2}
          title="Times"
          description={listOpen ? "Veja ou gere os times balanceados." : "Libera depois que a lista de confirmados for publicada."}
        />
        <HubCard
          href={`/racha/${id}/mvp`}
          icon={Trophy}
          title="Jogador Destaque"
          description={isFinished ? "Escolhido pelos organizadores." : "Libera depois que o racha terminar."}
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
      className="group flex items-start gap-4 rounded-xl border border-white/10 p-5 transition hover:border-brand-purple hover:shadow-sm"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-purple/10 text-purple-300 transition group-hover:bg-brand-purple group-hover:text-white">
        <Icon className="h-5 w-5" strokeWidth={2} />
      </span>
      <div>
        <p className="font-semibold text-white">{title}</p>
        <p className="mt-1 text-sm text-white/60">{description}</p>
      </div>
    </Link>
  );
}
