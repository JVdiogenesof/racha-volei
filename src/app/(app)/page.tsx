import Link from "next/link";
import Image from "next/image";
import { CalendarDays, Clock, MapPin, Megaphone, ArrowRight, ThumbsUp, Sparkles, ChevronRight, Star, Trophy, Medal, Users, Zap, Shirt, Gauge, CheckCircle2, Target } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { InterestButton } from "@/components/InterestButton";
import { ConfirmedCounter } from "@/components/ConfirmedCounter";
import { BirthdaysCard } from "@/components/BirthdaysCard";
import { RecentTournamentChampionCard } from "@/components/RecentTournamentChampionCard";
import { OrganizerPanel } from "@/components/OrganizerPanel";
import { RachaLevelBadge } from "@/components/RachaLevelBadge";
import { NicknamePromptCard } from "@/components/NicknamePromptCard";
import { EventCountdown } from "@/components/EventCountdown";
import { getRachaLevel } from "@/lib/rachaLevel";
import { setAttendance } from "./racha/[id]/confirmar/actions";
import { teamFormatLabel } from "@/lib/rachaFormat";
import { TeamsCarousel } from "@/components/TeamsCarousel";
import { HomeCommunityTabs } from "@/components/HomeCommunityTabs";
import { birthdaysThisMonth } from "@/lib/birthdays";
import { getActiveCommunity } from "@/lib/community";
import { isRegistrationOpen } from "@/lib/registrationSchedule";
import { RegistrationCountdown } from "@/components/RegistrationCountdown";
import { getSeasonRanking, INDEX_MIN_EVENTS } from "@/lib/seasonRanking";
import { TOURNAMENT_QUALIFYING_SLOTS } from "@/lib/rankings";

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
  const community = await getActiveCommunity(profile);
  const today = new Date().toISOString().slice(0, 10);
  const [{ data: upcomingRachas }, { data: avisos }, { data: birthdayProfiles }, { data: recentFinal }, seasonScores] =
    await Promise.all([
      supabase
        .from("events")
        .select("id, date, time, location, team_size, status, official_list_open, price_per_player, max_players, newcomer_reserved_spots, is_pre_torneio, is_mini_torneio, registration_opens_at")
        .eq("community", community)
        .gte("date", today)
        .neq("status", "finished")
        .neq("status", "cancelled")
        .order("date", { ascending: true })
        .order("time", { ascending: true })
        .limit(6),
      supabase
        .from("announcements")
        .select("id, title, body, image_url, created_at, profiles(full_name)")
        .eq("community", community)
        .order("created_at", { ascending: false })
        .limit(1),
      supabase.from("profiles").select("id, full_name, birthdate, avatar_url").eq("status", "approved").contains("communities", [community]),
      // Card do time campeão do pré-torneio -- some sozinho 48h depois da
      // final ser decidida (ver hoursAgoIso acima).
      supabase
        .from("tournament_matches")
        .select("team_a_id, team_b_id, score_a, score_b, events!inner(date, community, is_pre_torneio)")
        .eq("events.community", community)
        .eq("events.is_pre_torneio", true)
        .eq("stage", "final")
        .not("score_a", "is", null)
        .not("score_b", "is", null)
        .gte("played_at", hoursAgoIso(48))
        .order("played_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      // Posição do jogador no Índice VPA da temporada (faixa "Sua posição").
      profile.status === "approved" ? getSeasonRanking(supabase, community) : Promise.resolve(null),
    ]);

  const proximoRacha = upcomingRachas?.[0] ?? null;
  const secondaryScheduledCandidates = (upcomingRachas ?? [])
    .slice(1)
    .filter(
      (event) =>
        event.registration_opens_at &&
        !isRegistrationOpen(event.registration_opens_at, event.official_list_open),
    );
  const secondaryScheduledRacha =
    secondaryScheduledCandidates.find((event) => event.is_pre_torneio) ?? secondaryScheduledCandidates[0] ?? null;

  let recentChampion: { eventDateLabel: string; teamName: string; players: { fullName: string; avatarUrl: string | null }[] } | null = null;
  if (recentFinal) {
    const championTeamId = recentFinal.score_a! > recentFinal.score_b! ? recentFinal.team_a_id : recentFinal.team_b_id;
    const [{ data: championTeam }, { data: memberRows }] = await Promise.all([
      supabase.from("teams").select("name").eq("id", championTeamId).maybeSingle(),
      supabase.from("team_members").select("profiles(full_name, avatar_url)").eq("team_id", championTeamId),
    ]);
    const event = recentFinal.events as unknown as { date: string } | null;
    if (championTeam && event) {
      recentChampion = {
        eventDateLabel: new Date(`${event.date}T00:00:00`).toLocaleDateString("pt-BR"),
        teamName: championTeam.name,
        players: (memberRows ?? []).map((m) => {
          const p = m.profiles as unknown as { full_name: string; avatar_url: string | null } | null;
          return { fullName: p?.full_name ?? "?", avatarUrl: p?.avatar_url ?? null };
        }),
      };
    }
  }

  const { data: myAttendance } = proximoRacha
    ? await supabase
        .from("attendance")
        .select("status")
        .eq("event_id", proximoRacha.id)
        .eq("profile_id", profile.id)
        .maybeSingle()
    : { data: null };

  const [{ count: confirmedCount }, { count: newcomerConfirmedCount }] = proximoRacha
    ? await Promise.all([
        supabase
          .from("attendance")
          .select("id", { count: "exact", head: true })
          .eq("event_id", proximoRacha.id)
          .eq("status", "confirmed"),
        supabase
          .from("attendance")
          .select("id", { count: "exact", head: true })
          .eq("event_id", proximoRacha.id)
          .eq("status", "confirmed")
          .eq("uses_newcomer_spot", true),
      ])
    : [{ count: null }, { count: null }];
  const reservedSpots = proximoRacha?.newcomer_reserved_spots ?? 0;
  const regularConfirmedCount = Math.max(0, (confirmedCount ?? 0) - (newcomerConfirmedCount ?? 0));
  const memberCapacity =
    proximoRacha?.max_players != null ? Math.max(0, proximoRacha.max_players - reservedSpots) : null;
  const isFull =
    proximoRacha?.max_players != null &&
    (profile.status === "guest"
      ? (confirmedCount ?? 0) >= proximoRacha.max_players
      : memberCapacity !== null && regularConfirmedCount >= memberCapacity);

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
  const [{ count: reserveCount }, { count: interessadosCount }, { data: declineRows }] =
    profile.is_organizer
      ? await Promise.all([
          supabase.from("reserve_list").select("id", { count: "exact", head: true }).contains("communities", [community]),
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
      : [{ count: 0 }, { count: 0 }, { data: [] }];

  const rachaLevel =
    proximoRacha?.official_list_open ? await getRachaLevel(supabase, proximoRacha.id) : null;
  const isInProgress = proximoRacha?.status === "in_progress";
  const myStatus = myAttendance?.status;
  const canRespondToNextEvent =
    profile.status === "approved" ||
    (profile.status === "guest" && profile.guest_for_event_id === proximoRacha?.id);
  const registrationOpen = proximoRacha
    ? isRegistrationOpen(proximoRacha.registration_opens_at, proximoRacha.official_list_open)
    : false;
  const ultimoAviso = avisos?.[0] ?? null;
  const avisoAuthor = ultimoAviso
    ? (ultimoAviso.profiles as unknown as { full_name: string } | null)?.full_name
    : null;
  const avisoIsNew = ultimoAviso ? isRecent(ultimoAviso.created_at, 3) : false;
  const avisoPreview =
    ultimoAviso && ultimoAviso.body.length > 100 ? `${ultimoAviso.body.slice(0, 100).trim()}…` : ultimoAviso?.body;
  const birthdayCount = birthdaysThisMonth(birthdayProfiles ?? []).length;

  // Mesma base do Ranking: entra quem é aprovado na comunidade e já atingiu
  // o mínimo de participações na janela viva do Índice VPA.
  const approvedIds = new Set((birthdayProfiles ?? []).map((item) => item.id));
  const rankedSeason = seasonScores
    ? [...seasonScores.values()]
        .filter((item) => item.eligible && approvedIds.has(item.profileId))
        .sort((a, b) => b.averageIndex - a.averageIndex || b.totalWins - a.totalWins)
    : [];
  const mySeason = seasonScores?.get(profile.id) ?? null;
  const myRankIndex = rankedSeason.findIndex((item) => item.profileId === profile.id);
  const myPosition = myRankIndex >= 0 ? myRankIndex + 1 : null;
  const cutoffScore = rankedSeason.length >= TOURNAMENT_QUALIFYING_SLOTS ? rankedSeason[TOURNAMENT_QUALIFYING_SLOTS - 1].averageIndex : null;
  const myQualified = myPosition !== null && myPosition <= TOURNAMENT_QUALIFYING_SLOTS;
  const myGap = myPosition !== null && !myQualified && cutoffScore !== null && mySeason
    ? Math.max(0, Math.round((cutoffScore - mySeason.averageIndex) * 10) / 10)
    : null;

  const firstName = profile.full_name.split(" ")[0];
  const preTorneio = Boolean(proximoRacha?.is_pre_torneio);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-purple-300">VPA · {community === "sand" ? "Racha de Areia" : "Racha de Quadra"}</p>
          <h1 className="mt-0.5 truncate text-[22px] font-extrabold leading-tight text-white sm:text-3xl">Fala, {firstName}!</h1>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <Link href="/ranking" aria-label="Ver ranking" className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-purple-200 transition hover:bg-white/10">
            <Trophy className="h-[18px] w-[18px]" strokeWidth={2.25} />
          </Link>
          <Link href="/racha" aria-label="Ver rachas" className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-purple-200 transition hover:bg-white/10">
            <CalendarDays className="h-[18px] w-[18px]" strokeWidth={2.25} />
          </Link>
        </div>
      </div>

      {profile.status === "approved" && (
        <Link
          href="/ranking"
          className="flex min-w-0 items-center gap-3 rounded-2xl border border-purple-300/20 bg-gradient-to-r from-purple-500/15 to-transparent px-2.5 py-1.5 transition hover:border-purple-300/35"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-400/20 text-purple-100">
            <Gauge className="h-4 w-4" strokeWidth={2.25} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wide text-white/40">Sua posição · Índice VPA</p>
            {myPosition !== null && mySeason ? (
              <p className="flex items-baseline gap-2 text-white">
                <span className="text-lg font-black leading-tight">{myPosition}º</span>
                <span className="truncate text-xs font-medium text-white/55">{mySeason.averageIndex.toFixed(1)} pts</span>
              </p>
            ) : (
              <p className="truncate text-sm font-semibold leading-snug text-white/75">
                {mySeason
                  ? `Em classificação · ${mySeason.eventsPlayed}/${INDEX_MIN_EVENTS} rachas jogados`
                  : "Jogue um racha pra entrar no ranking"}
              </p>
            )}
          </div>
          {myQualified ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-400/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2.5} />
              Classificado
            </span>
          ) : myGap !== null && myGap > 0 ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-400/12 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-amber-300">
              <Target className="h-3.5 w-3.5" strokeWidth={2.5} />
              −{myGap.toFixed(1)} p/ vaga
            </span>
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-white/30" />
          )}
        </Link>
      )}

      <section
        className={
          preTorneio
            ? "relative overflow-hidden rounded-2xl border border-amber-400/30 bg-gradient-to-br from-amber-400/18 via-[#352354] to-[#171136] p-3 shadow-xl shadow-black/15"
            : "relative overflow-hidden rounded-2xl border border-purple-300/20 bg-gradient-to-br from-[#51339a] via-[#2f205e] to-[#171136] p-3 shadow-xl shadow-black/15"
        }
      >
        <span className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-purple-300/10 blur-2xl" />
        <div className="relative flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <span
            className={
              preTorneio
                ? "flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-amber-400/20 text-amber-300"
                : "flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-white/12 text-purple-100"
            }
          >
            {preTorneio ? <Trophy className="h-4 w-4" strokeWidth={2.25} /> : <CalendarDays className="h-4 w-4" strokeWidth={2.25} />}
          </span>
          <h2 className="text-sm font-bold text-white">Próximo racha</h2>
          {preTorneio && (
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-300">Pré-torneio</span>
          )}
          {proximoRacha?.is_mini_torneio && (
            <span className="inline-flex items-center gap-1 rounded-full bg-cyan-400/15 px-2 py-0.5 text-[10px] font-bold text-cyan-100">
              <Medal className="h-3 w-3" />
              Mini torneio
            </span>
          )}
          {proximoRacha && (
            <span className="rounded-full bg-white/12 px-2 py-0.5 text-[10px] font-bold text-purple-100">
              {teamFormatLabel(proximoRacha.team_size)}
            </span>
          )}
          {proximoRacha && myStatus === "confirmed" && (
            <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-green-400/15 px-2 py-0.5 text-[10px] font-bold text-green-200">
              <CheckCircle2 className="h-3 w-3" strokeWidth={2.75} />
              Confirmado
            </span>
          )}
        </div>

        {proximoRacha ? (
          <div className="relative mt-2.5 space-y-2.5">
            {proximoRacha.time && (
              <EventCountdown
                startIso={`${proximoRacha.date}T${proximoRacha.time}-03:00`}
                isInProgress={isInProgress}
                compact
              />
            )}

            <div className={`grid gap-1.5 ${rachaLevel !== null ? "grid-cols-2" : "grid-cols-[1fr_1fr_1.5fr]"}`}>
              <div className="min-w-0 rounded-[10px] bg-white/[0.07] px-2.5 py-1.5">
                <p className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.08em] text-white/40"><CalendarDays className="h-2.5 w-2.5" strokeWidth={2.75} />Data</p>
                <p className="truncate text-[13px] font-semibold capitalize text-white">
                  {new Date(`${proximoRacha.date}T00:00:00`).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })}
                </p>
              </div>
              {proximoRacha.time && (
                <div className="min-w-0 rounded-[10px] bg-white/[0.07] px-2.5 py-1.5">
                  <p className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.08em] text-white/40"><Clock className="h-2.5 w-2.5" strokeWidth={2.75} />Hora</p>
                  <p className="truncate text-[13px] font-semibold text-white">{proximoRacha.time.slice(0, 5)}</p>
                </div>
              )}
              {proximoRacha.location && (
                <div className={`min-w-0 rounded-[10px] bg-white/[0.07] px-2.5 py-1.5 ${rachaLevel !== null ? "col-span-2" : ""}`}>
                  <p className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.08em] text-white/40"><MapPin className="h-2.5 w-2.5" strokeWidth={2.75} />Local</p>
                  <p className="truncate text-[13px] font-semibold text-white">{proximoRacha.location}</p>
                </div>
              )}
              {rachaLevel !== null && (
                <div className="col-span-2 flex items-center gap-1.5 rounded-[10px] bg-white/[0.07] px-2.5 py-1.5">
                  <Star className="h-3.5 w-3.5 shrink-0 text-purple-200" strokeWidth={2.25} />
                  <RachaLevelBadge level={rachaLevel} />
                </div>
              )}
            </div>

            {!registrationOpen && proximoRacha.registration_opens_at ? (
              <>
                <RegistrationCountdown opensAt={proximoRacha.registration_opens_at} compact />
                <Link
                  href={`/racha/${proximoRacha.id}`}
                  className="inline-flex min-h-10 w-full items-center justify-center gap-1 rounded-xl border border-white/15 px-3 text-sm font-semibold text-white/75 hover:bg-white/10"
                >
                  Ver detalhes do racha
                  <ChevronRight className="h-4 w-4" strokeWidth={2} />
                </Link>
              </>
            ) : (
              <>
                <ConfirmedCounter eventId={proximoRacha.id} maxPlayers={proximoRacha.max_players} initialConfirmedCount={confirmedCount ?? 0} compact showFullCapacity={profile.is_organizer} />
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  {!canRespondToNextEvent ? (
                    <Link
                      href={`/racha/${proximoRacha.id}/confirmar`}
                      className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-amber-300/25 bg-amber-400/10 px-3 text-center text-sm font-bold text-amber-100 hover:bg-amber-400/15"
                    >
                      <Users className="h-4 w-4" strokeWidth={2.25} />
                      Acompanhar
                    </Link>
                  ) : myStatus === "confirmed" ? (
                    <Link
                      href={`/racha/${proximoRacha.id}`}
                      className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-brand-purple px-3 text-sm font-bold text-white shadow-lg shadow-purple-950/25 hover:bg-brand-purple-dark"
                    >
                      <Zap className="h-4 w-4" strokeWidth={2.25} />
                      Abrir racha
                    </Link>
                  ) : myStatus === "interested" ? (
                    <Link
                      href={`/racha/${proximoRacha.id}/confirmar`}
                      className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-brand-purple px-3 text-sm font-bold text-white shadow-lg shadow-purple-950/25 hover:bg-brand-purple-dark"
                    >
                      <ThumbsUp className="h-4 w-4" strokeWidth={2.25} />
                      Ver interesse
                    </Link>
                  ) : (
                    <InterestButton
                      eventId={proximoRacha.id}
                      price={proximoRacha.price_per_player ? Number(proximoRacha.price_per_player) : null}
                      isFull={isFull}
                      action={setAttendance}
                      className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-brand-purple px-3 text-sm font-bold text-white shadow-lg shadow-purple-950/25 hover:bg-brand-purple-dark disabled:opacity-50"
                    />
                  )}
                  <Link
                    href={`/racha/${proximoRacha.id}/confirmar`}
                    className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl border border-white/15 px-3.5 text-center text-sm font-semibold text-white/80 hover:bg-white/10"
                  >
                    Ver lista
                    <ChevronRight className="h-4 w-4" strokeWidth={2.25} />
                  </Link>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="relative mt-2.5 rounded-xl border border-dashed border-white/15 bg-black/10 px-4 py-5 text-center">
            <CalendarDays className="mx-auto h-7 w-7 text-white/25" strokeWidth={1.5} />
            <p className="mt-2 text-sm font-medium text-white/70">Nenhum racha marcado ainda.</p>
            <p className="mt-0.5 text-xs text-white/40">O próximo evento vai aparecer aqui.</p>
          </div>
        )}
      </section>

      {secondaryScheduledRacha?.registration_opens_at && (
        <section className="overflow-hidden rounded-2xl border border-amber-300/20 bg-gradient-to-br from-[#29174f] via-[#211442] to-[#15102d] p-3 shadow-lg shadow-black/15">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-amber-400/12 text-amber-200">
              {secondaryScheduledRacha.is_pre_torneio ? <Trophy className="h-4 w-4" strokeWidth={2.25} /> : <CalendarDays className="h-4 w-4" strokeWidth={2.25} />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/40">Próxima abertura</p>
              <h2 className="truncate text-sm font-bold text-white">
                {secondaryScheduledRacha.is_pre_torneio
                  ? "Pré-torneio agendado"
                  : secondaryScheduledRacha.is_mini_torneio
                    ? "Mini torneio agendado"
                    : "Próximo racha agendado"}
              </h2>
              <p className="flex flex-wrap items-center gap-x-2.5 text-[11px] text-white/55">
                <span className="inline-flex items-center gap-1 capitalize">
                  <CalendarDays className="h-3 w-3 text-purple-200" strokeWidth={2.25} />
                  {new Date(`${secondaryScheduledRacha.date}T00:00:00`).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })}
                </span>
                {secondaryScheduledRacha.time && (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3 text-purple-200" strokeWidth={2.25} />
                    {secondaryScheduledRacha.time.slice(0, 5)}
                  </span>
                )}
              </p>
            </div>
            <Link href={`/racha/${secondaryScheduledRacha.id}`} aria-label="Ver racha agendado" className="inline-flex min-h-9 shrink-0 items-center gap-0.5 rounded-xl border border-white/12 px-2.5 text-xs font-semibold text-white/75 hover:bg-white/10">
              Ver
              <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.25} />
            </Link>
          </div>
          <div className="mt-2.5">
            <RegistrationCountdown opensAt={secondaryScheduledRacha.registration_opens_at} compact />
          </div>
        </section>
      )}

      {community === "sand" ? (
      <section className="overflow-hidden rounded-2xl border border-purple-300/25 bg-[#10071f] shadow-xl shadow-purple-950/20">
        <div className={`relative overflow-hidden bg-black aspect-[8/5]`}>
          <Image src="/camisas/colecao-areia-vpa.webp" alt="Camisas roxas do Racha de Areia VPA" fill priority sizes="(max-width: 1024px) 100vw, 960px" className="object-contain object-center" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#130827] via-[#130827]/40 to-transparent" />
          <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-purple-200/25 bg-black/45 px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[0.14em] text-purple-100 backdrop-blur">
            <Sparkles className="h-3 w-3" strokeWidth={2.5} />
            Nova coleção
          </span>
          <div className="absolute inset-x-0 bottom-0 flex items-center gap-3 p-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-[15px] font-extrabold leading-tight text-white">A nova pele do nosso racha</h2>
              <p className="truncate text-[11px] text-white/70">Veja os modelos e peça a sua camisa</p>
            </div>
            <Link
              href="/camisas"
              className="inline-flex min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-brand-purple px-3 text-xs font-bold text-white shadow-lg shadow-purple-950/40 hover:bg-brand-purple-dark"
            >
              <Shirt className="h-3.5 w-3.5" strokeWidth={2.25} />
              Ver modelos
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.5} />
            </Link>
          </div>
        </div>
      </section>
      ) : (
        <TeamsCarousel />
      )}

      {recentChampion && (
        <RecentTournamentChampionCard
          eventDateLabel={recentChampion.eventDateLabel}
          teamName={recentChampion.teamName}
          players={recentChampion.players}
        />
      )}

      {profile.status === "approved" && !profile.nickname_badge && <NicknamePromptCard />}

      {profile.is_organizer && (
        <OrganizerPanel
          proximoRachaId={proximoRacha?.id ?? null}
          interessadosCount={interessadosCount ?? 0}
          vagasRestantes={
            memberCapacity != null ? Math.max(0, memberCapacity - regularConfirmedCount) : null
          }
          reserveCount={reserveCount ?? 0}
          recentDeclines={(declineRows ?? []).map((d) => ({
            fullName: (d.profiles as unknown as { full_name: string } | null)?.full_name ?? "?",
          }))}
        />
      )}

      <HomeCommunityTabs
        birthdayCount={birthdayCount}
        announcementContent={
          <div className="p-2.5">
            {ultimoAviso ? (
              <Link href="/avisos" className="flex items-center gap-3 rounded-xl p-1.5 transition hover:bg-white/5">
                {ultimoAviso.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={ultimoAviso.image_url} alt="" className="h-11 w-11 shrink-0 rounded-xl object-cover" />
                ) : (
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-purple/25 text-purple-200"><Megaphone className="h-[18px] w-[18px]" strokeWidth={2.25} /></span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-[13px] font-bold text-white">{ultimoAviso.title}</p>
                    {avisoIsNew && <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-purple/30 px-1.5 py-0.5 text-[8px] font-extrabold text-purple-200"><Sparkles className="h-2.5 w-2.5" /> NOVO</span>}
                  </div>
                  <p className="truncate text-[11px] text-white/55">{avisoPreview}</p>
                  <p className="text-[10px] text-white/35">{avisoAuthor} · {relativeDate(ultimoAviso.created_at)}</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-white/30" />
              </Link>
            ) : (
              <p className="rounded-xl p-2 text-sm text-white/50">Nenhum aviso ainda.</p>
            )}
            <Link href="/avisos" className="mt-1 flex items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] font-semibold text-purple-300 hover:underline">
              Ver todos os avisos <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        }
        birthdaysContent={<BirthdaysCard profiles={birthdayProfiles ?? []} embedded />}
      />
    </div>
  );
}
