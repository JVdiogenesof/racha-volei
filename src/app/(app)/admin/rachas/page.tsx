import { createClient } from "@/lib/supabase/server";
import { requireOrganizer } from "@/lib/auth";
import { EventListItem } from "@/components/EventListItem";
import { createEvent, updateEvent, deleteEvent } from "./actions";

export default async function AdminRachasPage() {
  await requireOrganizer();
  const supabase = await createClient();

  const { data: events } = await supabase
    .from("events")
    .select("id, date, time, location, num_teams, price_per_player, status")
    .order("date", { ascending: false });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-brand-navy">Criar racha</h1>
        <p className="mt-1 text-sm text-gray-500">
          Depois de criado, o racha aparece pra todo mundo confirmar presença.
        </p>
      </div>

      <form
        action={createEvent}
        className="grid gap-4 rounded-xl border border-gray-200 p-6 sm:grid-cols-2"
      >
        <div>
          <label className="block text-sm font-medium text-brand-navy">Data</label>
          <input
            type="date"
            name="date"
            required
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-brand-navy">
            Horário <span className="text-gray-400">(opcional)</span>
          </label>
          <input type="time" name="time" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium text-brand-navy">
            Local <span className="text-gray-400">(opcional)</span>
          </label>
          <input name="location" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium text-brand-navy">Número de times</label>
          <input
            type="number"
            name="numTeams"
            defaultValue={2}
            min={2}
            required
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-brand-navy">
            Valor por jogador (R$) <span className="text-gray-400">(opcional)</span>
          </label>
          <input
            type="number"
            name="pricePerPlayer"
            step={0.5}
            min={0}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
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
        <h2 className="font-semibold text-brand-navy">Rachas criados</h2>
        <div className="mt-3 space-y-2">
          {events?.map((e) => (
            <EventListItem key={e.id} event={e} updateEvent={updateEvent} deleteEvent={deleteEvent} />
          ))}
          {!events?.length && <p className="text-sm text-gray-500">Nenhum racha criado ainda.</p>}
        </div>
      </section>
    </div>
  );
}
