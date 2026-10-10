import { Calendar, Clock, MapPin, QrCode, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireOrganizer } from "@/lib/auth";
import { EventListItem } from "@/components/EventListItem";
import { RachaCapacityFields } from "@/components/RachaCapacityFields";
import { RegistrationScheduleFields } from "@/components/RegistrationScheduleFields";
import { FormField } from "@/components/FormField";
import { ToggleCard } from "@/components/ToggleCard";
import { createEvent, updateEvent, cancelEvent, deleteEvent } from "./actions";
import { getActiveCommunity } from "@/lib/community";

export default async function AdminRachasPage() {
  const organizer = await requireOrganizer();
  const supabase = await createClient();
  const community = await getActiveCommunity(organizer);

  const { data: events } = await supabase
    .from("events")
    .select(
      "id, date, time, location, num_teams, team_size, price_per_player, pix_payment_enabled, max_players, newcomer_reserved_spots, status, official_list_open, is_pre_torneio, is_mini_torneio, registration_opens_at",
    )
    .eq("community", community)
    .order("date", { ascending: false });

  // Pré-preenche o formulário com os dados do último racha criado, só
  // avançando a data em 7 dias — pra não precisar redigitar tudo toda
  // semana, só ajustar o que mudou.
  const lastEvent = events?.[0] ?? null;
  let suggestedDate = "";
  let suggestedRegistrationOpensAt: string | null = null;
  if (lastEvent) {
    const d = new Date(`${lastEvent.date}T00:00:00`);
    d.setDate(d.getDate() + 7);
    suggestedDate = d.toISOString().slice(0, 10);
    if (lastEvent.registration_opens_at) {
      const opening = new Date(lastEvent.registration_opens_at);
      opening.setDate(opening.getDate() + 7);
      suggestedRegistrationOpensAt = opening.toISOString();
    } else {
      suggestedRegistrationOpensAt = new Date(`${suggestedDate}T18:00:00-03:00`).toISOString();
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Criar racha de {community === "sand" ? "areia" : "quadra"}</h1>
        <p className="mt-1 text-sm text-white/60">
          Depois de criado, o racha aparece pra todo mundo confirmar presença.
        </p>
      </div>

      <form
        action={createEvent}
        className="grid gap-3.5 rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:grid-cols-2"
      >
        <FormField
          label="Data"
          icon={Calendar}
          type="date"
          name="date"
          defaultValue={suggestedDate}
          required
          hint={lastEvent ? "Sugerido: uma semana depois do último racha." : undefined}
        />
        <FormField
          label="Horário"
          icon={Clock}
          optional
          type="time"
          name="time"
          defaultValue={lastEvent?.time?.slice(0, 5) ?? ""}
        />
        <div className="sm:col-span-2">
          <FormField
            label="Local"
            icon={MapPin}
            optional
            name="location"
            defaultValue={lastEvent?.location ?? ""}
          />
        </div>
        <ToggleCard
          name="pixPaymentEnabled"
          icon={QrCode}
          title="Ativar Pix automático neste racha"
          description="A pessoa reserva a vaga por 5 minutos, paga por QR Code ou copia e cola e entra na lista automaticamente."
        />
        <RegistrationScheduleFields defaultOpensAt={suggestedRegistrationOpensAt} />
        <RachaCapacityFields
          defaultNumTeams={lastEvent?.num_teams ?? 2}
          defaultMaxPlayers={lastEvent?.max_players ?? null}
          defaultTeamSize={lastEvent?.team_size ?? 6}
          defaultNewcomerReservedSpots={lastEvent?.newcomer_reserved_spots ?? 0}
        />
        <FormField
          label="Valor por jogador"
          icon={Wallet}
          optional
          type="number"
          name="pricePerPlayer"
          step={0.5}
          min={0}
          prefix="R$"
          defaultValue={lastEvent?.price_per_player ?? ""}
        />
        <div className="sm:col-span-2">
          <button
            type="submit"
            className="rounded-xl bg-brand-purple px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-purple-dark"
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
