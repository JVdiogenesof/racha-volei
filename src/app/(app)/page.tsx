import Link from "next/link";
import { CalendarDays, Megaphone, ArrowRight, Sparkles, ChevronRight, Trophy, Gauge, CheckCircle2, Target } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { HomeRachaCard } from "@/components/HomeRachaCard";
import { BirthdaysCard } from "@/components/BirthdaysCard";
import { TodayBirthdayCard } from "@/components/TodayBirthdayCard";
import { RecentTournamentChampionCard } from "@/components/RecentTournamentChampionCard";
import { CopaHomeCard } from "@/components/CopaHomeCard";
import { COPA_PATH, cupCapacity, cupFinalDateLabel, daysUntilInBrazil, getCopaHomeSummary } from "@/lib/copaVpa";
import { OrganizerPanel } from "@/components/OrganizerPanel";
import { NicknamePromptCard } from "@/components/NicknamePromptCard";
import { getRachaLevel } from "@/lib/rachaLevel";
import { setAttendance } from "./racha/[id]/confirmar/actions";
import { isBlockedByBatch } from "@/lib/registrationSchedule";
import { isListFullFor } from "@/lib/rachaSpots";
import { HomeTeamsVideo } from "@/components/HomeTeamsVideo";
import { HomeCommunityTabs } from "@/components/HomeCommunityTabs";
import { birthdaysThisMonth } from "@/lib/birthdays";
import { getActiveCommunity } from "@/lib/community";
import { getSeasonRanking, INDEX_MIN_EVENTS } from "@/lib/seasonRanking";
import { TOURNAMENT_QUALIFYING_SLOTS } from "@/lib/rankings";
import { getTournamentZone } from "@/lib/tournamentQualification";
import { todayStringInFortaleza } from "@/lib/today";
import { SpotOfferBanner } from "@/components/SpotOfferBanner";
import { AbsenceWarningBanner } from "@/components/AbsenceWarningBanner";
import { getAbsenceStreaks, ATTENDANCE_ALERT_THRESHOLD } from "@/lib/attendancePolicy";
import { acceptSpotOffer, declineSpotOffer } from "./racha/[id]/confirmar/actions";

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
  const community = await getActiveCommunity();
  const today = todayStringInFortaleza();
  const [{ data: upcomingRachas }, { data: avisos }, { data: birthdayProfiles }, { data: recentFinal }, seasonScores, absenceStreaks] =
    await Promise.all([
      supabase
        .from("events")
        .select("id, date, time, location, team_size, status, official_list_open, price_per_player, pix_payment_enabled, max_players, newcomer_reserved_spots, is_pre_torneio, is_mini_torneio, registration_opens_at, first_batch_spots, second_batch_opens_at")
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
      // Faltas seguidas, pro aviso de quem está perto do limite do regulamento.
      profile.status === "approved" ? getAbsenceStreaks(supabase, community) : Promise.resolve(null),
    ]);
  const myAbsenceStreak = absenceStreaks?.get(profile.id) ?? 0;
  const [{ data: reservedRows }, { data: myPendingOffer }, { data: myExemption }, copaSummary] = await Promise.all([
    profile.status === "approved"
      ? supabase.from("tournament_reserved_players").select("profile_id").eq("community", community)
      : Promise.resolve({ data: null }),
    supabase
      .from("spot_offers")
      .select("event_id, expires_at, events(pix_payment_enabled, price_per_player)")
      .eq("profile_id", profile.id)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .maybeSingle(),
    supabase.from("payment_exempt_profiles").select("profile_id").eq("profile_id", profile.id).maybeSingle(),
    getCopaHomeSummary(supabase, community, profile.id).catch(() => null),
  ]);
  const isPaymentExempt = Boolean(myExemption);
  const reservedIds = new Set((reservedRows ?? []).map((row) => row.profile_id));
  const amGuaranteed = reservedIds.has(profile.id);
  const myPendingOfferEvent = myPendingOffer?.events as unknown as
    | { pix_payment_enabled: boolean; price_per_player: string | null }
    | null;

  const proximoRacha = upcomingRachas?.[0] ?? null;
  // Mostra o segundo racha marcado com o mesmo card do primeiro, tanto antes
  // quanto depois de as inscrições abrirem (assim ninguém confunde os dois).
  const secondaryCandidates = (upcomingRachas ?? [])
    .slice(1)
    .filter((event) => event.registration_opens_at || event.official_list_open);
  const secondaryRacha = secondaryCandidates.find((event) => event.is_pre_torneio) ?? secondaryCandidates[0] ?? null;

  // Situação da pessoa e contagens do segundo racha (o primeiro usa as consultas abaixo).
  const loadSecondaryState = async (event: NonNullable<typeof secondaryRacha>) => {
    const [{ data: attendance }, { data: payment }, { count: confirmed }, { count: newcomers }, { count: setters }, level] = await Promise.all([
      supabase.from("attendance").select("status").eq("event_id", event.id).eq("profile_id", profile.id).maybeSingle(),
      supabase.from("payments").select("paid").eq("event_id", event.id).eq("profile_id", profile.id).maybeSingle(),
      supabase.from("attendance").select("id", { count: "exact", head: true }).eq("event_id", event.id).eq("status", "confirmed"),
      supabase.from("attendance").select("id", { count: "exact", head: true }).eq("event_id", event.id).eq("status", "confirmed").eq("uses_newcomer_spot", true),
      supabase.from("attendance").select("id", { count: "exact", head: true }).eq("event_id", event.id).eq("status", "confirmed").eq("uses_setter_spot", true),
      event.official_list_open ? getRachaLevel(supabase, event.id) : Promise.resolve(null),
    ]);
    const confirmedTotal = confirmed ?? 0;
    const batchFull = isBlockedByBatch(event, confirmedTotal, setters ?? 0, Boolean(profile.is_setter));
    const full =
      batchFull ||
      (event.max_players != null &&
      isListFullFor({
        capacity: event.max_players,
        newcomerReserved: event.newcomer_reserved_spots ?? 0,
        confirmed: confirmedTotal,
        setters: setters ?? 0,
        newcomers: newcomers ?? 0,
        isSetter: Boolean(profile.is_setter),
        isGuest: profile.status === "guest",
      }));
    return {
      status: attendance?.status,
      paid: Boolean(payment?.paid),
      confirmedCount: confirmedTotal,
      setterCount: setters ?? 0,
      level,
      isFull: full,
      canRespond: profile.status === "approved" || (profile.status === "guest" && profile.guest_for_event_id === event.id),
    };
  };

  type RecentChampion = { eventDateLabel: string; teamName: string; players: { fullName: string; avatarUrl: string | null }[] };
  const loadChampion = async (): Promise<RecentChampion | null> => {
    if (!recentFinal) return null;
    const championTeamId = recentFinal.score_a! > recentFinal.score_b! ? recentFinal.team_a_id : recentFinal.team_b_id;
    const [{ data: championTeam }, { data: memberRows }] = await Promise.all([
      supabase.from("teams").select("name").eq("id", championTeamId).maybeSingle(),
      supabase.from("team_members").select("profiles(full_name, avatar_url)").eq("team_id", championTeamId),
    ]);
    const event = recentFinal.events as unknown as { date: string } | null;
    if (!championTeam || !event) return null;
    return {
      eventDateLabel: new Date(`${event.date}T00:00:00`).toLocaleDateString("pt-BR"),
      teamName: championTeam.name,
      players: (memberRows ?? []).map((m) => {
        const p = m.profiles as unknown as { full_name: string; avatar_url: string | null } | null;
        return { fullName: p?.full_name ?? "?", avatarUrl: p?.avatar_url ?? null };
      }),
    };
  };

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

  // Tudo abaixo só depende do próximo racha: roda em paralelo, em vez de uma
  // consulta esperando a outra (era o que deixava a tela de início lenta).
  const [
    recentChampion,
    { data: myAttendance },
    { data: myPayment },
    { count: confirmedCount },
    { count: newcomerConfirmedCount },
    { count: setterConfirmedCount },
    { count: reserveCount },
    { count: interessadosCount },
    { data: declineRows },
    rachaLevel,
    secondaryState,
  ] = await Promise.all([
    loadChampion(),
    proximoRacha
      ? supabase.from("attendance").select("status").eq("event_id", proximoRacha.id).eq("profile_id", profile.id).maybeSingle()
      : Promise.resolve({ data: null }),
    proximoRacha
      ? supabase.from("payments").select("paid").eq("event_id", proximoRacha.id).eq("profile_id", profile.id).maybeSingle()
      : Promise.resolve({ data: null }),
    proximoRacha
      ? supabase.from("attendance").select("id", { count: "exact", head: true }).eq("event_id", proximoRacha.id).eq("status", "confirmed")
      : Promise.resolve({ count: null }),
    proximoRacha
      ? supabase.from("attendance").select("id", { count: "exact", head: true }).eq("event_id", proximoRacha.id).eq("status", "confirmed").eq("uses_newcomer_spot", true)
      : Promise.resolve({ count: null }),
    proximoRacha
      ? supabase.from("attendance").select("id", { count: "exact", head: true }).eq("event_id", proximoRacha.id).eq("status", "confirmed").eq("uses_setter_spot", true)
      : Promise.resolve({ count: null }),
    profile.is_organizer
      ? supabase.from("reserve_list").select("id", { count: "exact", head: true }).contains("communities", [community])
      : Promise.resolve({ count: 0 }),
    profile.is_organizer
      ? supabase.from("attendance").select("id", { count: "exact", head: true }).eq("event_id", eventIdForPanel).eq("status", "interested")
      : Promise.resolve({ count: 0 }),
    profile.is_organizer
      ? supabase
          .from("attendance")
          .select("profile_id, profiles(full_name)")
          .eq("event_id", eventIdForPanel)
          .eq("status", "declined")
          .not("cancelled_at", "is", null)
          .gte("cancelled_at", declineWindowStart)
      : Promise.resolve({ data: [] as { profile_id: string; profiles: unknown }[] }),
    proximoRacha?.official_list_open ? getRachaLevel(supabase, proximoRacha.id) : Promise.resolve(null),
    secondaryRacha ? loadSecondaryState(secondaryRacha) : Promise.resolve(null),
  ]);
  const memberCapacity =
    proximoRacha?.max_players != null ? Math.max(0, proximoRacha.max_players - (proximoRacha.newcomer_reserved_spots ?? 0)) : null;
  const regularConfirmedCount = Math.max(0, (confirmedCount ?? 0) - (newcomerConfirmedCount ?? 0));
  const nextBatchFull =
    proximoRacha != null && isBlockedByBatch(proximoRacha, confirmedCount ?? 0, setterConfirmedCount ?? 0, Boolean(profile.is_setter));
  const isFull =
    nextBatchFull ||
    (proximoRacha?.max_players != null &&
    isListFullFor({
      capacity: proximoRacha.max_players,
      newcomerReserved: proximoRacha.newcomer_reserved_spots ?? 0,
      confirmed: confirmedCount ?? 0,
      setters: setterConfirmedCount ?? 0,
      newcomers: newcomerConfirmedCount ?? 0,
      isSetter: Boolean(profile.is_setter),
      isGuest: profile.status === "guest",
    }));

  const myStatus = myAttendance?.status;
  const canRespondToNextEvent =
    profile.status === "approved" ||
    (profile.status === "guest" && profile.guest_for_event_id === proximoRacha?.id);
  const paymentDone = Boolean(myPayment?.paid);
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
  // Quem já garantiu vaga no pré-torneio não ocupa vaga do ranking: a zona desce.
  const qualificationZone = getTournamentZone(rankedSeason.map((item) => item.profileId), reservedIds, TOURNAMENT_QUALIFYING_SLOTS);
  const cutoffScore = qualificationZone.cutoffPosition !== null ? rankedSeason[qualificationZone.cutoffPosition - 1].averageIndex : null;
  const myQualified = amGuaranteed || (myPosition !== null && myPosition <= qualificationZone.zoneEnd);
  const myGap = myPosition !== null && !myQualified && cutoffScore !== null && mySeason
    ? Math.max(0, Math.round((cutoffScore - mySeason.averageIndex) * 10) / 10)
    : null;

  const firstName = profile.full_name.split(" ")[0];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-purple-300">VPA · Racha de Quadra</p>
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

      {myPendingOffer && (
        <SpotOfferBanner
          eventId={myPendingOffer.event_id}
          expiresAt={myPendingOffer.expires_at}
          needsPixPayment={Boolean(myPendingOfferEvent?.pix_payment_enabled && myPendingOfferEvent?.price_per_player)}
          price={myPendingOfferEvent?.price_per_player ? Number(myPendingOfferEvent.price_per_player) : null}
          acceptAction={acceptSpotOffer}
          declineAction={declineSpotOffer}
          setAttendanceAction={setAttendance}
        />
      )}

      {myAbsenceStreak >= ATTENDANCE_ALERT_THRESHOLD && <AbsenceWarningBanner streak={myAbsenceStreak} />}

      <TodayBirthdayCard profiles={birthdayProfiles ?? []} />

      {copaSummary && (
        <CopaHomeCard
          href={COPA_PATH}
          name={copaSummary.cup.name}
          finalDateLabel={cupFinalDateLabel(copaSummary.cup)}
          remaining={copaSummary.cup.final_date ? daysUntilInBrazil(copaSummary.cup.final_date) : null}
          capacity={cupCapacity(copaSummary.cup)}
          qualifiedCount={copaSummary.qualifiedCount}
          iAmQualified={copaSummary.iAmQualified}
        />
      )}

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

      {proximoRacha ? (
        <HomeRachaCard
          event={proximoRacha}
          myStatus={myStatus}
          paid={paymentDone}
          confirmedCount={confirmedCount ?? 0}
          setterConfirmedCount={setterConfirmedCount ?? 0}
          rachaLevel={rachaLevel}
          canRespond={canRespondToNextEvent}
          isPaymentExempt={isPaymentExempt}
          isFull={isFull}
          isOrganizer={profile.is_organizer}
          action={setAttendance}
        />
      ) : (
        <section className="copa-frame rounded-3xl">
          <div className="copa-hero theme-ranking copa-shine rounded-[22px]">
            <div className="relative z-10 p-3.5">
              <div className="rounded-2xl border border-dashed border-white/20 bg-black/15 px-4 py-6 text-center">
                <CalendarDays className="mx-auto h-7 w-7 text-white/30" strokeWidth={1.5} />
                <p className="mt-2 text-sm font-medium text-white/80">Nenhum racha marcado ainda.</p>
                <p className="mt-0.5 text-xs text-white/50">O próximo evento vai aparecer aqui.</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {secondaryRacha && secondaryState && (
        <HomeRachaCard
          event={secondaryRacha}
          myStatus={secondaryState.status}
          paid={secondaryState.paid}
          confirmedCount={secondaryState.confirmedCount}
          setterConfirmedCount={secondaryState.setterCount}
          rachaLevel={secondaryState.level}
          canRespond={secondaryState.canRespond}
          isPaymentExempt={isPaymentExempt}
          isFull={secondaryState.isFull}
          isOrganizer={profile.is_organizer}
          action={setAttendance}
        />
      )}

      <HomeTeamsVideo />

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
