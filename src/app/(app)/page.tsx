import Link from "next/link";
import Image from "next/image";
import { CalendarDays, Clock, MapPin, Megaphone, ArrowRight, ThumbsUp, Sparkles, ChevronRight, Star, Trophy, Medal, Users, Zap, Shirt } from "lucide-react";
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
import { AutoPlayShirtVideo } from "@/components/AutoPlayShirtVideo";
import { HomeCommunityTabs } from "@/components/HomeCommunityTabs";
import { birthdaysThisMonth } from "@/lib/birthdays";
import { getActiveCommunity } from "@/lib/community";
import { isRegistrationOpen } from "@/lib/registrationSchedule";
import { RegistrationCountdown } from "@/components/RegistrationCountdown";

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
  const [{ data: proximoRacha }, { data: avisos }, { data: birthdayProfiles }, { data: recentFinal }] =
    await Promise.all([
      supabase
        .from("events")
        .select("id, date, time, location, team_size, status, official_list_open, price_per_player, max_players, newcomer_reserved_spots, is_pre_torneio, is_mini_torneio, registration_opens_at")
        .eq("community", community)
        .gte("date", today)
        .neq("status", "finished")
        .neq("status", "cancelled")
        .order("date", { ascending: true })
        .limit(1)
        .maybeSingle(),
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
    ]);

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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-purple-300">VPA · {community === "sand" ? "Racha de Areia" : "Racha de Quadra"}</p>
          <h1 className="mt-0.5 text-2xl font-bold text-white sm:text-3xl">Fala, {profile.full_name.split(" ")[0]}! 🏐</h1>
        </div>
        <Link href="/racha" className="inline-flex items-center gap-1 text-sm font-medium text-purple-300 hover:underline">Ver rachas <ChevronRight className="h-4 w-4" /></Link>
      </div>

      <section
        className={
          proximoRacha?.is_pre_torneio
            ? "relative overflow-hidden rounded-2xl border border-amber-400/30 bg-gradient-to-br from-amber-400/18 via-[#352354] to-[#171136] p-4 shadow-xl shadow-black/15"
            : "relative overflow-hidden rounded-2xl border border-purple-300/20 bg-gradient-to-br from-[#51339a] via-[#2f205e] to-[#171136] p-4 shadow-xl shadow-black/15"
        }
      >
        <span className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-purple-300/10 blur-2xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={
                proximoRacha?.is_pre_torneio
                  ? "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-400/20 text-amber-300"
                  : "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-purple-100"
              }
            >
              {proximoRacha?.is_pre_torneio ? (
                <Trophy className="h-4.5 w-4.5" strokeWidth={2} />
              ) : (
                <CalendarDays className="h-4.5 w-4.5" strokeWidth={2} />
              )}
            </span>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/40">Próxima partida</p>
              <h2 className="font-bold">Próximo racha</h2>
            </div>
            {proximoRacha?.is_pre_torneio && (
              <span className="inline-flex items-center rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-300">
                Pré-torneio
              </span>
            )}
            {proximoRacha?.is_mini_torneio && (
              <span className="inline-flex items-center gap-1 rounded-full bg-cyan-400/15 px-2.5 py-1 text-xs font-medium text-cyan-100">
                <Medal className="h-3 w-3" />
                Mini torneio
              </span>
            )}
            {proximoRacha && (
              <span className="inline-flex items-center rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-purple-100">
                {teamFormatLabel(proximoRacha.team_size)}
              </span>
            )}
          </div>
          {proximoRacha && myStatus === "confirmed" && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-green-300/15 bg-green-400/15 px-2.5 py-1 text-[11px] font-bold text-green-200">
                <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                Confirmado
              </span>
          )}
        </div>

        {proximoRacha ? (
          <div className="relative mt-3 grid gap-3 border-t border-white/10 pt-3 md:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-2">
              {proximoRacha.time && (
                <EventCountdown
                  startIso={`${proximoRacha.date}T${proximoRacha.time}-03:00`}
                  isInProgress={isInProgress}
                  compact
                />
              )}

              <div className="flex flex-wrap gap-1.5 text-xs text-white/75">
                <p className="flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-2">
                  <CalendarDays className="h-4 w-4 shrink-0 text-purple-200" strokeWidth={2} />
                  {new Date(`${proximoRacha.date}T00:00:00`).toLocaleDateString("pt-BR", {
                    weekday: "short",
                    day: "2-digit",
                    month: "2-digit",
                  })}
                </p>
                {proximoRacha.time && (
                  <p className="flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-2">
                    <Clock className="h-4 w-4 shrink-0 text-purple-200" strokeWidth={2} />
                    {proximoRacha.time.slice(0, 5)}
                  </p>
                )}
                {proximoRacha.location && (
                  <p className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-2">
                    <MapPin className="h-4 w-4 shrink-0 text-purple-200" strokeWidth={2} />
                    <span className="min-w-0 truncate">{proximoRacha.location}</span>
                  </p>
                )}
                {rachaLevel !== null && (
                  <div className="flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-2">
                    <Star className="h-4 w-4 shrink-0 text-purple-200" strokeWidth={2} />
                    <RachaLevelBadge level={rachaLevel} />
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
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
                <ConfirmedCounter eventId={proximoRacha.id} maxPlayers={proximoRacha.max_players} initialConfirmedCount={confirmedCount ?? 0} compact />
                <div className="grid grid-cols-2 gap-2">
                {!canRespondToNextEvent ? (
                  <Link
                    href={`/racha/${proximoRacha.id}/confirmar`}
                    className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-amber-300/25 bg-amber-400/10 px-3 text-center text-sm font-bold text-amber-100 hover:bg-amber-400/15"
                  >
                    <Users className="h-4 w-4" strokeWidth={2} />
                    Acompanhar
                  </Link>
                ) : myStatus === "confirmed" ? (
                  <Link
                    href={`/racha/${proximoRacha.id}`}
                    className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-brand-purple px-3 text-sm font-bold text-white shadow-lg shadow-purple-950/25 hover:bg-brand-purple-dark"
                  >
                    <Zap className="h-4 w-4" strokeWidth={2} />
                    Abrir racha
                  </Link>
                ) : myStatus === "interested" ? (
                  <Link
                    href={`/racha/${proximoRacha.id}/confirmar`}
                    className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-brand-purple px-3 text-sm font-bold text-white shadow-lg shadow-purple-950/25 hover:bg-brand-purple-dark"
                  >
                    <ThumbsUp className="h-4 w-4" strokeWidth={2} />
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
                  className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl border border-white/15 px-3 text-center text-sm font-semibold text-white/80 hover:bg-white/10"
                >
                  Ver lista
                  <ChevronRight className="h-4 w-4" strokeWidth={2} />
                </Link>
                </div>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="relative mt-3 rounded-xl border border-dashed border-white/15 bg-black/10 px-4 py-5 text-center">
            <CalendarDays className="mx-auto h-8 w-8 text-white/25" strokeWidth={1.5} />
            <p className="mt-3 font-medium text-white/70">Nenhum racha marcado ainda.</p>
            <p className="mt-1 text-sm text-white/40">O próximo evento vai aparecer aqui.</p>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-purple-300/25 bg-gradient-to-br from-[#28134d] via-[#1b0c35] to-[#10071f] shadow-xl shadow-purple-950/20">
          <div className={`relative overflow-hidden bg-black ${community === "sand" ? "aspect-[8/5]" : "aspect-video"}`}>
            {community === "sand" ? (
              <Image src="/camisas/colecao-areia-vpa.webp" alt="Camisas roxas do Racha de Areia VPA" fill priority sizes="(max-width: 1024px) 100vw, 960px" className="object-contain object-center" />
            ) : (
              <AutoPlayShirtVideo />
            )}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#130827] via-transparent to-black/20" />
            <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full border border-purple-200/20 bg-black/45 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-purple-100 backdrop-blur sm:left-5 sm:top-5">
              <Sparkles className="h-3.5 w-3.5" />
              Lançamento oficial
            </span>
          </div>
          <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-purple-300">
                <Sparkles className="h-3.5 w-3.5" />
                Nova coleção VPA
              </p>
              <h2 className="mt-1 text-xl font-black text-white">A nova pele do nosso racha</h2>
              <p className="mt-1 text-sm text-white/55">Conheça os modelos e escolha sua nova camisa do VPA.</p>
            </div>
            <Link
              href="/camisas"
              className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-brand-purple px-4 text-sm font-bold text-white shadow-lg shadow-purple-950/30 hover:bg-brand-purple-dark"
            >
              <Shirt className="h-4 w-4" />
              Ver modelos e pedidos
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
      </section>

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
          <div className="p-1">
            <div className="flex justify-end">
              <Link href="/avisos" className="inline-flex items-center gap-1 text-xs font-medium text-purple-300 hover:underline">Ver todos <ArrowRight className="h-3.5 w-3.5" /></Link>
            </div>
            {ultimoAviso ? (
              <Link href="/avisos" className="mt-1.5 flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 transition hover:bg-white/10">
                {ultimoAviso.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={ultimoAviso.image_url} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
                ) : (
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-brand-purple/20 text-purple-200"><Megaphone className="h-5 w-5" /></span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-white">{ultimoAviso.title}</p>
                    {avisoIsNew && <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-purple/25 px-2 py-0.5 text-[9px] font-bold text-purple-200"><Sparkles className="h-2.5 w-2.5" /> Novo</span>}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-white/55">{avisoPreview}</p>
                  <p className="mt-1 text-[11px] text-white/35">{avisoAuthor} · {relativeDate(ultimoAviso.created_at)}</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-white/30" />
              </Link>
            ) : (
              <p className="mt-2 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/50">Nenhum aviso ainda.</p>
            )}
          </div>
        }
        birthdaysContent={<BirthdaysCard profiles={birthdayProfiles ?? []} />}
      />
    </div>
  );
}
