import { createClient } from "@/lib/supabase/server";
import { requireOrganizer } from "@/lib/auth";
import { EventListItem } from "@/components/EventListItem";
import { RachaCapacityFields } from "@/components/RachaCapacityFields";
import { createEvent, updateEvent, cancelEvent, deleteEvent } from "./actions";

export default async function AdminRachasPage() {
  await requireOrganizer();
  const supabase = await createClient();

  const { data: events } = await supabase
    .from("events")
    .select("id, date, time, location, num_teams, price_per_player, max_players, status, official_list_open")
    .order("date", { ascending: false });

  // Pré-preenche o formulário com os dados do último racha criado, só
  // avançando a data em 7 dias — pra não precisar redigitar tudo toda
  // semana, só ajustar o que mudou.
  const lastEvent = events?.[0] ?? null;
  let suggestedDate = "";
  if (lastEvent) {
    const d = new Date(`${lastEvent.date}T00:00:00`);
    d.setDate(d.getDate() + 7);
    suggestedDate = d.toISOString().slice(0, 10);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Criar racha</h1>
        <p className="mt-1 text-sm text-white/60">
          Depois de criado, o racha aparece pra todo mundo confirmar presença.
        </p>
      </div>

      <form
        action={createEvent}
        className="grid gap-4 rounded-xl border border-white/10 p-6 sm:grid-cols-2"
      >
        <div>
          <label className="block text-sm font-medium text-white">Data</label>
          <input
            type="date"
            name="date"
            defaultValue={suggestedDate}
            required
            className="mt-1 w-full rounded-lg border border-white/15 px-3 py-2"
          />
          {lastEvent && <p className="mt-1 text-xs text-white/40">Sugerido: uma semana depois do último racha.</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-white">
            Horário <span className="text-white/40">(opcional)</span>
          </label>
          <input
            type="time"
            name="time"
            defaultValue={lastEvent?.time?.slice(0, 5) ?? ""}
            className="mt-1 w-full rounded-lg border border-white/15 px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-white">
            Local <span className="text-white/40">(opcional)</span>
          </label>
          <input
            name="location"
            defaultValue={lastEvent?.location ?? ""}
            className="mt-1 w-full rounded-lg border border-white/15 px-3 py-2"
          />
        </div>
        <RachaCapacityFields
          defaultNumTeams={lastEvent?.num_teams ?? 2}
          defaultMaxPlayers={lastEvent?.max_players ?? null}
        />
        <div>
          <label className="block text-sm font-medium text-white">
            Valor por jogador (R$) <span className="text-white/40">(opcional)</span>
          </label>
          <input
            type="number"
            name="pricePerPlayer"
            step={0.5}
            min={0}
            defaultValue={lastEvent?.price_per_player ?? ""}
            className="mt-1 w-full rounded-lg border border-white/15 px-3 py-2"
          />
        </div>
        <div className="sm:col-span-2">
          <button
            type="submit"
            className="rounded-lg bg-brand-purple px-4 py-2 font-medium text-white hover:bg-brand-purple-dark"
          >
            Criar racha
          </button>
        </div>
      </form>

      <section>
        <h2 className="font-semibold text-white">Rachas criados</h2>
        <div className="mt-3 space-y-2">
          {events?.map((e) => (
            <EventListItem
              key={e.id}
              event={e}
              updateEvent={updateEvent}
              cancelEvent={cancelEvent}
              deleteEvent={deleteEvent}
            />
          ))}
          {!events?.length && <p className="text-sm text-white/60">Nenhum racha criado ainda.</p>}
        </div>
      </section>
    </div>
  );
}
