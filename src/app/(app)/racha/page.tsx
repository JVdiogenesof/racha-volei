import Link from "next/link";
import { Plus, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { EVENT_STATUS_LABELS } from "@/lib/eventStatus";

export default async function RachaListPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: events } = await supabase
    .from("events")
    .select("id, date, time, location, status, official_list_open")
    .order("date", { ascending: false });

  const today = new Date().toISOString().slice(0, 10);
  const proximos = events?.filter((e) => e.date >= today) ?? [];
  const passados = events?.filter((e) => e.date < today) ?? [];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-brand-navy">Rachas</h1>
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

      <section>
        <h2 className="font-semibold text-brand-navy">Próximos</h2>
        <div className="mt-3 space-y-2">
          {!proximos.length && <p className="text-sm text-gray-500">Nenhum racha marcado ainda.</p>}
          {proximos.map((e) => (
            <EventRow key={e.id} event={e} />
          ))}
        </div>
      </section>

      {passados.length > 0 && (
        <section>
          <h2 className="font-semibold text-brand-navy">Passados</h2>
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
  };
}) {
  return (
    <Link
      href={`/racha/${event.id}`}
      className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3 hover:bg-gray-50"
    >
      <div>
        <p className="font-medium text-brand-navy">
          {new Date(`${event.date}T00:00:00`).toLocaleDateString("pt-BR", {
            weekday: "long",
            day: "2-digit",
            month: "2-digit",
          })}
          {event.time ? ` · ${event.time.slice(0, 5)}` : ""}
        </p>
        {event.location && (
          <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
            <MapPin className="h-3.5 w-3.5" strokeWidth={2} />
            {event.location}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {event.status === "open" && (
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
              event.official_list_open ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"
            }`}
          >
            {event.official_list_open ? "Lista aberta" : "Interesse"}
          </span>
        )}
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
            EVENT_STATUS_LABELS[event.status]?.className ?? "bg-gray-100 text-gray-500"
          }`}
        >
          {EVENT_STATUS_LABELS[event.status]?.label ?? event.status}
        </span>
      </div>
    </Link>
  );
}
