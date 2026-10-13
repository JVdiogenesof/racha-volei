import Link from "next/link";
import { Plus, MapPin, ChevronRight, Trophy, Medal, Map as MapIcon, Radio, ArrowRight, CheckCircle2, Clock3, Eye, UserRoundCheck, XCircle, CircleHelp, CalendarClock, type LucideIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { EVENT_STATUS_LABELS } from "@/lib/eventStatus";
import { teamFormatLabel } from "@/lib/rachaFormat";
import { getActiveCommunity } from "@/lib/community";
import { EmptyState } from "@/components/EmptyState";
import { isRegistrationOpen, registrationInputParts } from "@/lib/registrationSchedule";

const NR_SPORT_TRAINING_ADDRESS = "NR Sport Training, Rua Maria Josefina Pessoa, 226, Fortaleza, Brazil";
const NR_SPORT_TRAINING_MAPS_URL = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(NR_SPORT_TRAINING_ADDRESS)}`;

function isNrSportTraining(location: string | null) {
  return !!location && location.toLowerCase().includes("nr sport");
}

type AttendanceStatus = "confirmed" | "interested" | "declined";
type AttendanceIndicatorData = { label: string; className: string; icon: LucideIcon } | null;

function getAttendanceIndicator({
  attendanceStatus,
  isGuestEvent,
  isVisitor,
  ended,
}: {
  attendanceStatus: AttendanceStatus | null;
  isGuestEvent: boolean;
  isVisitor: boolean;
  ended: boolean;
}): AttendanceIndicatorData {
  if (attendanceStatus === "confirmed") return { label: ended ? "Você participou" : "Você está confirmado", className: "border-green-400/25 bg-green-500/12 text-green-300", icon: CheckCircle2 };
  if (attendanceStatus === "interested") return { label: "Interesse marcado", className: "border-purple-300/25 bg-purple-400/12 text-purple-200", icon: Clock3 };
  if (attendanceStatus === "declined") return { label: "Você não vai", className: "border-red-300/20 bg-red-400/10 text-red-200", icon: XCircle };
  if (isGuestEvent) return { label: "Convidado para este racha", className: "border-cyan-300/25 bg-cyan-400/10 text-cyan-200", icon: UserRoundCheck };
  if (isVisitor) return { label: "Somente visualização", className: "border-white/10 bg-white/5 text-white/45", icon: Eye };
  if (!ended) return { label: "Aguardando sua resposta", className: "border-amber-300/25 bg-amber-400/10 text-amber-200", icon: CircleHelp };
  return null;
}

export default async function RachaListPage({ searchParams }: { searchParams: Promise<{ aba?: string }> }) {
  const { aba } = await searchParams;
  const showPast = aba === "passados";
  const profile = await requireProfile();
  const supabase = await createClient();
  const community = await getActiveCommunity(profile);

  const [{ data: events }, { data: attendanceRows }] = await Promise.all([
    supabase
      .from("events")
      .select("id, date, time, location, team_size, status, official_list_open, is_pre_torneio, is_mini_torneio, registration_opens_at")
      .eq("community", community)
      .order("date", { ascending: false }),
    supabase.from("attendance").select("event_id, status").eq("profile_id", profile.id),
  ]);
  const attendanceByEvent = new Map((attendanceRows ?? []).map((row) => [row.event_id, row.status as AttendanceStatus]));

  const today = new Date().toISOString().slice(0, 10);
  const atuais = events?.filter((e) => e.status === "in_progress") ?? [];
  const proximos = events?.filter((e) => e.date >= today && e.status !== "in_progress") ?? [];
  const passados = events?.filter((e) => e.date < today && e.status !== "in_progress") ?? [];
  const indicatorFor = (event: { id: string; date: string; status: string }) => getAttendanceIndicator({
    attendanceStatus: attendanceByEvent.get(event.id) ?? null,
    isGuestEvent: profile.status === "guest" && profile.guest_for_event_id === event.id,
    isVisitor: profile.status !== "approved" && !(profile.status === "guest" && profile.guest_for_event_id === event.id),
    ended: event.date < today || event.status === "finished" || event.status === "cancelled",
  });

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-purple-300">{community === "sand" ? "Areia" : "Quadra"}</p>
          <h1 className="mt-0.5 text-2xl font-black text-white">Rachas</h1>
        </div>
        {profile.is_organizer && (
          <Link href="/admin/rachas" aria-label="Criar racha" className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-brand-purple px-3.5 text-sm font-bold text-white hover:bg-brand-purple-dark">
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            Criar
          </Link>
        )}
      </header>

      <div className="flex gap-1 rounded-2xl border border-white/10 bg-white/[0.03] p-1">
        <Link href="/racha" aria-current={!showPast ? "page" : undefined} className={`flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-xl text-xs font-semibold transition ${!showPast ? "bg-brand-purple text-white shadow-md shadow-purple-950/30" : "text-white/45 hover:text-white/75"}`}>
          Próximos <span className={`rounded-md px-1.5 py-0.5 text-[9px] font-black ${!showPast ? "bg-white/20" : "bg-white/[0.07]"}`}>{proximos.length + atuais.length}</span>
        </Link>
        <Link href="/racha?aba=passados" aria-current={showPast ? "page" : undefined} className={`flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-xl text-xs font-semibold transition ${showPast ? "bg-brand-purple text-white shadow-md shadow-purple-950/30" : "text-white/45 hover:text-white/75"}`}>
          Passados <span className={`rounded-md px-1.5 py-0.5 text-[9px] font-black ${showPast ? "bg-white/20" : "bg-white/[0.07]"}`}>{passados.length}</span>
        </Link>
      </div>

      {!showPast && atuais.length > 0 && (
        <section>
          <div className="mb-2 flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-400" />
            </span>
            <h2 className="text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-white/50">Acontecendo agora</h2>
          </div>
          <div className="space-y-2">
            {atuais.map((event) => (
              <CurrentEventCard key={event.id} event={event} indicator={indicatorFor(event)} />
            ))}
          </div>
        </section>
      )}

      {!showPast && (
        <section>
          <h2 className="mb-2 px-0.5 text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-white/40">Próximos</h2>
          <div className="space-y-1.5">
            {!proximos.length && <EmptyState compact icon={<CalendarClock className="h-5 w-5" />} title="Agenda livre no momento" description="Assim que o próximo racha for criado, ele aparecerá aqui com data, horário e confirmação." />}
            {proximos.map((e) => (
              <EventRow key={e.id} event={e} indicator={indicatorFor(e)} />
            ))}
          </div>
        </section>
      )}

      {showPast && (
        <section>
          <div className="space-y-1.5">
            {!passados.length && <EmptyState compact icon={<CalendarClock className="h-5 w-5" />} title="Nenhum racha passado" description="Os rachas encerrados aparecem aqui." />}
            {passados.map((e) => (
              <EventRow key={e.id} event={e} indicator={indicatorFor(e)} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function CurrentEventCard({
  event,
  indicator,
}: {
  event: {
    id: string;
    date: string;
    time: string | null;
    location: string | null;
    is_pre_torneio: boolean;
    is_mini_torneio: boolean;
    registration_opens_at: string | null;
    team_size: number;
  };
  indicator: AttendanceIndicatorData;
}) {
  const isArena = isNrSportTraining(event.location);

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-purple-300/25 bg-gradient-to-br from-[#5939a5] via-[#30205f] to-[#171136] p-3.5 shadow-xl shadow-black/20 sm:p-5">
      <Link href={`/racha/${event.id}`} className="absolute inset-0 z-10 rounded-2xl" aria-label="Abrir racha em andamento" />
      <span className="pointer-events-none absolute -right-14 -top-20 h-56 w-56 rounded-full bg-purple-200/10 blur-2xl" />
      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-red-300/20 bg-red-400/15 px-3 py-1 text-xs font-bold text-red-200">
              <Radio className="h-3.5 w-3.5" strokeWidth={2.5} />
              AO VIVO
            </span>
            {event.is_pre_torneio && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/15 px-3 py-1 text-xs font-medium text-amber-200">
                <Trophy className="h-3.5 w-3.5" />
                Pré-torneio
              </span>
            )}
            {event.is_mini_torneio && (
              <span className="inline-flex items-center gap-1 rounded-full bg-cyan-400/15 px-3 py-1 text-xs font-medium text-cyan-100">
                <Medal className="h-3.5 w-3.5" />
                Mini torneio
              </span>
            )}
            {indicator && <AttendanceIndicator indicator={indicator} />}
          </div>
          <h3 className="mt-3 text-xl font-black text-white">Racha rolando agora</h3>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-purple-200">
            {teamFormatLabel(event.team_size)}
          </p>
          <p className="mt-1 text-sm capitalize text-white/65">
            {new Date(`${event.date}T00:00:00`).toLocaleDateString("pt-BR", {
              weekday: "long",
              day: "2-digit",
              month: "2-digit",
            })}
            {event.time ? ` · ${event.time.slice(0, 5)}` : ""}
          </p>
          {event.location && (
            <p className="mt-3 flex items-center gap-2 text-sm text-white/75">
              {isArena ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src="/nr-sport-training-logo.jpg" alt="" className="h-7 w-7 rounded-full object-cover ring-1 ring-white/20" />
              ) : (
                <MapPin className="h-4 w-4 shrink-0 text-purple-200" />
              )}
              <span className="truncate">{event.location}</span>
              {isArena && (
                <a
                  href={NR_SPORT_TRAINING_MAPS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Ver localização no Google Maps"
                  className="relative z-20 rounded-md p-1 text-white/45 hover:bg-white/10 hover:text-white"
                >
                  <MapIcon className="h-4 w-4" />
                </a>
              )}
            </p>
          )}
        </div>
        <span className="relative inline-flex items-center gap-2 self-end rounded-xl bg-white px-3.5 py-2.5 text-sm font-bold text-[#281650] transition group-hover:bg-purple-100">
          Abrir racha
          <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
        </span>
      </div>
    </div>
  );
}

function EventRow({
  event,
  indicator,
}: {
  event: {
    id: string;
    date: string;
    time: string | null;
    location: string | null;
    status: string;
    official_list_open: boolean;
    is_pre_torneio: boolean;
    is_mini_torneio: boolean;
    registration_opens_at: string | null;
    team_size: number;
  };
  indicator: AttendanceIndicatorData;
}) {
  const isArena = isNrSportTraining(event.location);
  const registrationOpen = isRegistrationOpen(event.registration_opens_at, event.official_list_open);
  const registrationSchedule = registrationInputParts(event.registration_opens_at);

  const dateObj = new Date(`${event.date}T00:00:00`);
  const past = event.status === "finished" || event.status === "cancelled";
  const statusInfo = EVENT_STATUS_LABELS[event.status];
  const showStatus = !(event.status === "open" && !past);

  return (
    <div className={`relative flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-2.5 transition hover:bg-white/[0.06] ${past ? "opacity-85" : ""}`}>
      <Link href={`/racha/${event.id}`} className="absolute inset-0 rounded-2xl" aria-label="Ver racha" />
      <div className="w-12 shrink-0 rounded-xl bg-purple-400/15 py-1.5 text-center">
        <strong className="block text-[17px] font-black leading-tight text-white">{dateObj.toLocaleDateString("pt-BR", { day: "2-digit" })}</strong>
        <span className="text-[9.5px] font-extrabold uppercase tracking-wider text-purple-200">{dateObj.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-bold capitalize text-white">
          {dateObj.toLocaleDateString("pt-BR", { weekday: "long" })}
          {event.time ? ` · ${event.time.slice(0, 5)}` : ""}
        </p>
        <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px] text-white/55">
          {isArena && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/nr-sport-training-logo.jpg" alt="Logo da arena NR Sport Training" className="h-4 w-4 shrink-0 rounded-full object-cover ring-1 ring-white/15" />
          )}
          <span className="truncate">{event.location ?? "Local a definir"} · {teamFormatLabel(event.team_size)}</span>
          {isArena && (
            <a href={NR_SPORT_TRAINING_MAPS_URL} target="_blank" rel="noopener noreferrer" title="Ver no Google Maps" aria-label="Ver localização no Google Maps" className="relative z-10 shrink-0 rounded p-0.5 text-white/40 hover:text-purple-300">
              <MapIcon className="h-3.5 w-3.5" strokeWidth={2} />
            </a>
          )}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {indicator && <AttendanceIndicator indicator={indicator} />}
          {event.is_pre_torneio && (
            <span className="flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-300"><Trophy className="h-3 w-3" strokeWidth={2} />Pré-torneio</span>
          )}
          {event.is_mini_torneio && (
            <span className="flex items-center gap-1 rounded-full bg-cyan-500/15 px-2 py-0.5 text-[10px] font-bold text-cyan-200"><Medal className="h-3 w-3" strokeWidth={2} />Mini torneio</span>
          )}
          {!registrationOpen && event.registration_opens_at && (
            <span className="flex items-center gap-1 rounded-full border border-fuchsia-300/20 bg-fuchsia-400/10 px-2 py-0.5 text-[10px] font-bold text-fuchsia-100">
              <CalendarClock className="h-3 w-3" strokeWidth={2} />
              Inscrições {new Date(event.registration_opens_at).toLocaleDateString("pt-BR", { timeZone: "America/Fortaleza", day: "2-digit", month: "2-digit" })} às {registrationSchedule.time}
            </span>
          )}
          {event.status === "open" && (
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${event.official_list_open ? "bg-blue-500/15 text-blue-300" : "bg-amber-500/15 text-amber-300"}`}>
              {event.official_list_open ? "Lista publicada" : "Interesse"}
            </span>
          )}
          {showStatus && (
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${statusInfo?.className ?? "bg-white/10 text-white/60"}`}>
              {statusInfo?.label ?? event.status}
            </span>
          )}
        </div>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-white/30" />
    </div>
  );
}

function AttendanceIndicator({ indicator }: { indicator: NonNullable<AttendanceIndicatorData> }) {
  const Icon = indicator.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${indicator.className}`}>
      <Icon className="h-3 w-3" strokeWidth={2.25} />
      {indicator.label}
    </span>
  );
}
