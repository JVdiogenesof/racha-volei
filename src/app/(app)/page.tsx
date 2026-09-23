import Link from "next/link";
import { CalendarDays, Clock, MapPin, Megaphone, ArrowRight, ThumbsUp, Sparkles, ChevronRight, Star, Trophy, Users, Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { InterestButton } from "@/components/InterestButton";
import { ConfirmedCounter } from "@/components/ConfirmedCounter";
import { BirthdaysCard } from "@/components/BirthdaysCard";
import { RecentTournamentChampionCard } from "@/components/RecentTournamentChampionCard";
import { OrganizerPanel } from "@/components/OrganizerPanel";
import { RachaLevelBadge } from "@/components/RachaLevelBadge";
import { ReactionsReceivedCard } from "@/components/ReactionsReceivedCard";
import { NicknamePromptCard } from "@/components/NicknamePromptCard";
import { EventCountdown } from "@/components/EventCountdown";
import { getRachaLevel } from "@/lib/rachaLevel";
import { renderReactionText } from "@/lib/reactions";
import { setAttendance } from "./racha/[id]/confirmar/actions";

function hoursAgoIso(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function isRecent(dateStr: string, days: number) {
  return Date.now() - new Date(dateStr).getTime() < days * 24 * 60 * 60 * 1000;
}

function relativeDate(dateStr: string) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
  if (diffHours < 1) return "agora há pouco";
  if (diffHours < 24) return `há ${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "há 1 dia";
  if (diffDays < 7) return `há ${diffDays} dias`;
  return new Date(dateStr).toLocaleDateString("pt-BR");
}

export default async function HomePage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const today = new Date().toISOString().slice(0, 10);
  const [{ data: proximoRacha }, { data: avisos }, { data: birthdayProfiles }, { data: recentFinal }] =
    await Promise.all([
      supabase
        .from("events")
        .select("id, date, time, location, status, official_list_open, price_per_player, max_players, is_pre_torneio")
        .gte("date", today)
        .neq("status", "finished")
        .neq("status", "cancelled")
        .order("date", { ascending: true })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("announcements")
        .select("id, title, body, image_url, created_at, profiles(full_name)")
        .order("created_at", { ascending: false })
        .limit(1),
      supabase.from("profiles").select("id, full_name, birthdate, avatar_url").eq("status", "approved"),
      // Card do time campeão do pré-torneio -- some sozinho 48h depois da
      // final ser decidida (ver hoursAgoIso acima).
      supabase
        .from("tournament_matches")
        .select("team_a_id, team_b_id, score_a, score_b, events(date)")
        .eq("stage", "final")
        .not("score_a", "is", null)
        .not("score_b", "is", null)
        .gte("played_at", hoursAgoIso(48))
        .order("played_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  let recentChampion: { eventDateLabel: string; teamNumber: number; players: { fullName: string; avatarUrl: string | null }[] } | null = null;
  if (recentFinal) {
    const championTeamId = recentFinal.score_a! > recentFinal.score_b! ? recentFinal.team_a_id : recentFinal.team_b_id;
    const [{ data: championTeam }, { data: memberRows }] = await Promise.all([
      supabase.from("teams").select("team_number").eq("id", championTeamId).maybeSingle(),
      supabase.from("team_members").select("profiles(full_name, avatar_url)").eq("team_id", championTeamId),
    ]);
    const event = recentFinal.events as unknown as { date: string } | null;
    if (championTeam && event) {
      recentChampion = {
        eventDateLabel: new Date(`${event.date}T00:00:00`).toLocaleDateString("pt-BR"),
        teamNumber: championTeam.team_number,
        players: (memberRows ?? []).map((m) => {
          const p = m.profiles as unknown as { full_name: string; avatar_url: string | null } | null;
          return { fullName: p?.full_name ?? "?", avatarUrl: p?.avatar_url ?? null };
        }),
      };
    }
  }

  const { data: receivedReactionRows } = await supabase
    .from("reactions")
    .select("reaction_types(text), from:profiles!reactions_from_profile_id_profiles_id_fk(full_name, avatar_url)")
    .eq("to_profile_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(5);

  const receivedReactions = (receivedReactionRows ?? []).map((r) => {
    const from = r.from as unknown as { full_name: string; avatar_url: string | null } | null;
    const reactionType = r.reaction_types as unknown as { text: string } | null;
    return {
      fromName: from?.full_name ?? "?",
      fromAvatar: from?.avatar_url ?? null,
      text: reactionType ? renderReactionText(reactionType.text, "você") : "",
    };
  });

  const { data: myAttendance } = proximoRacha
    ? await supabase
        .from("attendance")
        .select("status")
        .eq("event_id", proximoRacha.id)
        .eq("profile_id", profile.id)
        .maybeSingle()
    : { data: null };

  const { count: confirmedCount } = proximoRacha
    ? await supabase
        .from("attendance")
        .select("id", { count: "exact", head: true })
        .eq("event_id", proximoRacha.id)
        .eq("status", "confirmed")
    : { count: null };
  const isFull =
    proximoRacha?.max_players != null && (confirmedCount ?? 0) >= proximoRacha.max_players;

  const eventIdForPanel = proximoRacha?.id ?? "";
  // O aviso de cancelamento é só pra quem já estava confirmado e saiu da lista
  // em cima da hora (dia do racha ou véspera) -- por isso a janela conta pra
  // trás a partir da data/horário do racha, não a partir de agora, senão
  // alguém que cancela com semanas de antecedência dispara o aviso do mesmo
  // jeito. Marcar "não vou" sem nunca ter confirmado não é "cancelamento" (ver
  // cancelled_at em setAttendance).
  const declineWindowStart = proximoRacha
    ? new Date(
        new Date(`${proximoRacha.date}T${proximoRacha.time ?? "00:00"}`).getTime() - 48 * 60 * 60 * 1000,
      ).toISOString()
    : hoursAgoIso(48);
  const [{ count: pendingCount }, { count: reserveCount }, { count: interessadosCount }, { data: declineRows }] =
    profile.is_organizer
      ? await Promise.all([
          supabase.from("profiles").select("id", { count: "exact", head: true }).eq("status", "pending"),
          supabase.from("reserve_list").select("id", { count: "exact", head: true }),
          supabase
            .from("attendance")
            .select("id", { count: "exact", head: true })
            .eq("event_id", eventIdForPanel)
            .eq("status", "interested"),
          supabase
            .from("attendance")
            .select("profile_id, profiles(full_name)")
            .eq("event_id", eventIdForPanel)
            .eq("status", "declined")
            .not("cancelled_at", "is", null)
            .gte("cancelled_at", declineWindowStart),
        ])
      : [{ count: 0 }, { count: 0 }, { count: 0 }, { data: [] }];

  const rachaLevel =
    proximoRacha?.official_list_open ? await getRachaLevel(supabase, proximoRacha.id) : null;
  const isInProgress = proximoRacha?.status === "in_progress";
  const myStatus = myAttendance?.status;
  const ultimoAviso = avisos?.[0] ?? null;
  const avisoAuthor = ultimoAviso
    ? (ultimoAviso.profiles as unknown as { full_name: string } | null)?.full_name
    : null;
  const avisoIsNew = ultimoAviso ? isRecent(ultimoAviso.created_at, 3) : false;
  const avisoPreview =
    ultimoAviso && ultimoAviso.body.length > 100 ? `${ultimoAviso.body.slice(0, 100).trim()}…` : ultimoAviso?.body;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white sm:text-3xl">Fala, {profile.full_name.split(" ")[0]}! 🏐</h1>
        <p className="mt-1 text-sm text-white/60">Bem-vindo ao racha da galera.</p>
      </div>

      <section
        className={
          proximoRacha?.is_pre_torneio
            ? "relative overflow-hidden rounded-3xl border border-amber-400/30 bg-gradient-to-br from-amber-400/20 via-[#352354] to-[#171136] p-5 shadow-2xl shadow-black/15 sm:p-6"
            : "relative overflow-hidden rounded-3xl border border-purple-300/20 bg-gradient-to-br from-[#51339a] via-[#2f205e] to-[#171136] p-5 shadow-2xl shadow-black/15 sm:p-6"
        }
      >
        <span className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-purple-300/10 blur-2xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <span
              className={
                proximoRacha?.is_pre_torneio
                  ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-400/20 text-amber-300"
                  : "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-purple-100"
              }
            >
              {proximoRacha?.is_pre_torneio ? (
                <Trophy className="h-4.5 w-4.5" strokeWidth={2} />
              ) : (
                <CalendarDays className="h-4.5 w-4.5" strokeWidth={2} />
              )}
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">Sua próxima partida</p>
              <h2 className="text-lg font-bold">Próximo racha</h2>
            </div>
            {proximoRacha?.is_pre_torneio && (
              <span className="inline-flex items-center rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-300">
                Pré-torneio
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {proximoRacha && myStatus === "confirmed" && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-green-300/15 bg-green-400/15 px-3 py-1 text-xs font-medium text-green-200">
                <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                Confirmado
              </span>
            )}
          </div>
        </div>

        {proximoRacha ? (
          <div className="relative mt-5 grid gap-4 border-t border-white/10 pt-5 sm:grid-cols-[1.15fr_0.85fr]">
            <div>
              {proximoRacha.time && (
                <EventCountdown
                  startIso={`${proximoRacha.date}T${proximoRacha.time}-03:00`}
                  isInProgress={isInProgress}
                />
              )}

              <div className="mt-4 grid gap-2 text-sm text-white/80 sm:grid-cols-2">
                <p className="flex items-center gap-2.5 rounded-lg bg-white/5 px-3 py-2.5">
                  <CalendarDays className="h-4 w-4 shrink-0 text-purple-200" strokeWidth={2} />
                  {new Date(`${proximoRacha.date}T00:00:00`).toLocaleDateString("pt-BR", {
                    weekday: "short",
                    day: "2-digit",
                    month: "2-digit",
                  })}
                </p>
                {proximoRacha.time && (
                  <p className="flex items-center gap-2.5 rounded-lg bg-white/5 px-3 py-2.5">
                    <Clock className="h-4 w-4 shrink-0 text-purple-200" strokeWidth={2} />
                    {proximoRacha.time.slice(0, 5)}
                  </p>
                )}
                {proximoRacha.location && (
                  <p className="flex items-center gap-2.5 rounded-lg bg-white/5 px-3 py-2.5 sm:col-span-2">
                    <MapPin className="h-4 w-4 shrink-0 text-purple-200" strokeWidth={2} />
                    <span className="min-w-0 truncate">{proximoRacha.location}</span>
                  </p>
                )}
                {rachaLevel !== null && (
                  <div className="flex items-center gap-2.5 rounded-lg bg-white/5 px-3 py-2.5 sm:col-span-2">
                    <Star className="h-4 w-4 shrink-0 text-purple-200" strokeWidth={2} />
                    <RachaLevelBadge level={rachaLevel} />
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col rounded-2xl border border-white/10 bg-black/10 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-white/75">
                <Users className="h-4 w-4 text-purple-200" strokeWidth={2} />
                Presença da galera
              </div>
              <div className="mt-3">
                <ConfirmedCounter
                  eventId={proximoRacha.id}
                  maxPlayers={proximoRacha.max_players}
                  initialConfirmedCount={confirmedCount ?? 0}
                />
              </div>

              <div className="mt-auto pt-4">
                {myStatus === "confirmed" ? (
                  <Link
                    href={`/racha/${proximoRacha.id}`}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-purple px-5 py-3.5 font-bold text-white shadow-lg shadow-purple-950/25 hover:bg-brand-purple-dark"
                  >
                    <Zap className="h-4 w-4" strokeWidth={2} />
                    Abrir racha
                    <ArrowRight className="h-4 w-4" strokeWidth={2} />
                  </Link>
                ) : myStatus === "interested" ? (
                  <Link
                    href={`/racha/${proximoRacha.id}/confirmar`}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-purple px-5 py-3.5 font-bold text-white shadow-lg shadow-purple-950/25 hover:bg-brand-purple-dark"
                  >
                    <ThumbsUp className="h-4 w-4" strokeWidth={2} />
                    Interesse registrado
                    <ArrowRight className="h-4 w-4" strokeWidth={2} />
                  </Link>
                ) : (
                  <InterestButton
                    eventId={proximoRacha.id}
                    price={proximoRacha.price_per_player ? Number(proximoRacha.price_per_player) : null}
                    isFull={isFull}
                    action={setAttendance}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-purple px-5 py-3.5 font-bold text-white shadow-lg shadow-purple-950/25 hover:bg-brand-purple-dark disabled:opacity-50"
                  />
                )}
                <Link
                  href={`/racha/${proximoRacha.id}/confirmar`}
                  className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium text-white/80 hover:bg-white/10"
                >
                  Ver lista de jogadores
                  <ArrowRight className="h-4 w-4" strokeWidth={2} />
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="relative mt-5 rounded-2xl border border-dashed border-white/15 bg-black/10 px-5 py-8 text-center">
            <CalendarDays className="mx-auto h-8 w-8 text-white/25" strokeWidth={1.5} />
            <p className="mt-3 font-medium text-white/70">Nenhum racha marcado ainda.</p>
            <p className="mt-1 text-sm text-white/40">O próximo evento vai aparecer aqui.</p>
          </div>
        )}
      </section>

      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-navy-light to-[#241a52] p-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.png"
          alt=""
          className="pointer-events-none absolute -bottom-8 -right-8 h-40 w-40 rotate-[-8deg] object-contain opacity-25 sm:h-48 sm:w-48"
        />
        <div className="relative max-w-xs">
          <p className="text-xs font-semibold uppercase tracking-wider text-purple-300">Vôlei por amor</p>
          <p className="mt-1 text-xl font-bold leading-snug sm:text-2xl">
            Mais que um jogo, <span className="text-purple-300">é a nossa resenha!</span>
          </p>
          <p className="mt-2 text-sm text-white/60">
            Aqui a gente joga, se diverte e mantém a amizade em quadra.
          </p>
        </div>
      </div>

      {recentChampion && (
        <RecentTournamentChampionCard
          eventDateLabel={recentChampion.eventDateLabel}
          teamNumber={recentChampion.teamNumber}
          players={recentChampion.players}
        />
      )}

      {(receivedReactions.length > 0 || !profile.nickname_badge) && (
        <div className="grid gap-3 sm:grid-cols-2">
          <ReactionsReceivedCard reactions={receivedReactions} />
          {!profile.nickname_badge && <NicknamePromptCard />}
        </div>
      )}

      {profile.is_organizer && (
        <OrganizerPanel
          proximoRachaId={proximoRacha?.id ?? null}
          interessadosCount={interessadosCount ?? 0}
          vagasRestantes={
            proximoRacha?.max_players != null
              ? Math.max(0, proximoRacha.max_players - (confirmedCount ?? 0))
              : null
          }
          pendingCount={pendingCount ?? 0}
          reserveCount={reserveCount ?? 0}
          recentDeclines={(declineRows ?? []).map((d) => ({
            fullName: (d.profiles as unknown as { full_name: string } | null)?.full_name ?? "?",
          }))}
        />
      )}

      <section>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-purple-300" strokeWidth={2} />
            <h2 className="font-semibold">Último aviso</h2>
          </div>
          <Link href="/avisos" className="inline-flex items-center gap-1 text-sm text-purple-300 hover:underline">
            Ver todos
            <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
          </Link>
        </div>

        {ultimoAviso ? (
          <Link
            href="/avisos"
            className="mt-3 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 transition hover:bg-white/10"
          >
            {ultimoAviso.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={ultimoAviso.image_url}
                alt=""
                className="h-16 w-16 shrink-0 rounded-xl object-cover"
              />
            ) : (
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-brand-purple/20 text-purple-200">
                <Megaphone className="h-6 w-6" strokeWidth={2} />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate font-medium text-white">{ultimoAviso.title}</p>
                {avisoIsNew && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-purple/25 px-2 py-0.5 text-[10px] font-medium text-purple-200">
                    <Sparkles className="h-2.5 w-2.5" strokeWidth={2} />
                    Novo
                  </span>
                )}
              </div>
              <p className="mt-0.5 truncate text-sm text-white/60">{avisoPreview}</p>
              <p className="mt-1 text-xs text-white/40">
                {avisoAuthor} · {relativeDate(ultimoAviso.created_at)}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-white/30" strokeWidth={2} />
          </Link>
        ) : (
          <p className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/50">
            Nenhum aviso ainda.
          </p>
        )}
      </section>

      <BirthdaysCard profiles={birthdayProfiles ?? []} />
    </div>
  );
}
