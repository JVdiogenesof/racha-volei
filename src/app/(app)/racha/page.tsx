import Link from "next/link";
import { Plus, MapPin, Trophy, Map as MapIcon, Radio, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { EVENT_STATUS_LABELS } from "@/lib/eventStatus";

const NR_SPORT_TRAINING_ADDRESS = "NR Sport Training, Rua Maria Josefina Pessoa, 226, Fortaleza, Brazil";
const NR_SPORT_TRAINING_MAPS_URL = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(NR_SPORT_TRAINING_ADDRESS)}`;

function isNrSportTraining(location: string | null) {
  return !!location && location.toLowerCase().includes("nr sport");
}

export default async function RachaListPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: events } = await supabase
    .from("events")
    .select("id, date, time, location, status, official_list_open, is_pre_torneio")
    .order("date", { ascending: false });

  const today = new Date().toISOString().slice(0, 10);
  const atuais = events?.filter((e) => e.status === "in_progress") ?? [];
  const proximos = events?.filter((e) => e.date >= today && e.status !== "in_progress") ?? [];
  const passados = events?.filter((e) => e.date < today && e.status !== "in_progress") ?? [];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Rachas</h1>
        {profile.is_organizer && (
          <Link
            href="/admin/rachas"
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-purple px-4 py-2 text-sm font-medium text-white hover:bg-brand-purple-dark"
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            Criar racha
          </Link>
        )}
      </div>

      {atuais.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-400" />
            </span>
            <h2 className="font-semibold text-white">Acontecendo agora</h2>
          </div>
          <div className="space-y-3">
            {atuais.map((event) => (
              <CurrentEventCard key={event.id} event={event} />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="font-semibold text-white">Próximos</h2>
        <div className="mt-3 space-y-2">
          {!proximos.length && <p className="text-sm text-white/60">Nenhum racha marcado ainda.</p>}
          {proximos.map((e) => (
            <EventRow key={e.id} event={e} />
          ))}
        </div>
      </section>

      {passados.length > 0 && (
        <section>
          <h2 className="font-semibold text-white">Passados</h2>
          <div className="mt-3 space-y-2">
            {passados.map((e) => (
              <EventRow key={e.id} event={e} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function CurrentEventCard({
  event,
}: {
  event: {
    id: string;
    date: string;
    time: string | null;
    location: string | null;
    is_pre_torneio: boolean;
  };
}) {
  const isArena = isNrSportTraining(event.location);

  return (
    <div className="group relative overflow-hidden rounded-3xl border border-purple-300/25 bg-gradient-to-br from-[#5939a5] via-[#30205f] to-[#171136] p-5 shadow-xl shadow-black/20 sm:p-6">
      <Link href={`/racha/${event.id}`} className="absolute inset-0 z-10 rounded-3xl" aria-label="Abrir racha em andamento" />
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
          </div>
          <h3 className="mt-4 text-2xl font-black text-white">Racha rolando agora</h3>
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
        <span className="relative inline-flex items-center gap-2 self-end rounded-xl bg-white px-4 py-3 text-sm font-bold text-[#281650] transition group-hover:bg-purple-100">
          Abrir racha
          <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
        </span>
      </div>
    </div>
  );
}

function EventRow({
  event,
}: {
  event: {
    id: string;
    date: string;
    time: string | null;
    location: string | null;
    status: string;
    official_list_open: boolean;
    is_pre_torneio: boolean;
  };
}) {
  const isArena = isNrSportTraining(event.location);

  return (
    <div className="relative flex items-center justify-between rounded-lg border border-white/10 px-4 py-3 hover:bg-white/5">
      <Link href={`/racha/${event.id}`} className="absolute inset-0 rounded-lg" aria-label="Ver racha" />
      <div className="flex min-w-0 items-center gap-3">
        {isArena && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src="/nr-sport-training-logo.jpg"
            alt="Logo da arena NR Sport Training"
            className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-white/15"
          />
        )}
        <div className="min-w-0">
          <p className="font-medium text-white">
            {new Date(`${event.date}T00:00:00`).toLocaleDateString("pt-BR", {
              weekday: "long",
              day: "2-digit",
              month: "2-digit",
            })}
            {event.time ? ` · ${event.time.slice(0, 5)}` : ""}
          </p>
          {event.location && (
            <p className="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-white/60">
              <MapPin className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
              <span className="truncate">{event.location}</span>
              {isArena && (
                <a
                  href={NR_SPORT_TRAINING_MAPS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Ver no Google Maps"
                  aria-label="Ver localização no Google Maps"
                  className="relative z-10 shrink-0 rounded p-0.5 text-white/40 hover:text-purple-300"
                >
                  <MapIcon className="h-3.5 w-3.5" strokeWidth={2} />
                </a>
              )}
            </p>
          )}
        </div>
      </div>
      <div className="relative flex shrink-0 items-center gap-2">
        {event.is_pre_torneio && (
          <span className="flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-300">
            <Trophy className="h-3 w-3" strokeWidth={2} />
            Pré-torneio
          </span>
        )}
        {event.status === "open" && (
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
              event.official_list_open ? "bg-blue-500/15 text-blue-300" : "bg-amber-500/15 text-amber-300"
            }`}
          >
            {event.official_list_open ? "Lista de confirmados publicada" : "Interesse"}
          </span>
        )}
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
            EVENT_STATUS_LABELS[event.status]?.className ?? "bg-white/10 text-white/60"
          }`}
        >
          {EVENT_STATUS_LABELS[event.status]?.label ?? event.status}
        </span>
      </div>
    </div>
  );
}
