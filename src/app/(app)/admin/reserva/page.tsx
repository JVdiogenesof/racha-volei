import { Phone, MapPin, CheckCircle2, Circle, UserCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireOrganizer } from "@/lib/auth";
import { ActionForm } from "@/components/ActionForm";
import { DeleteReserveEntryButton } from "@/components/DeleteReserveEntryButton";
import { InviteToEventForm } from "@/components/InviteToEventForm";
import { EndGuestAccessButton } from "@/components/EndGuestAccessButton";
import { MakePermanentButton } from "@/components/MakePermanentButton";
import { PromoteReserveButton } from "@/components/PromoteReserveButton";
import {
  toggleContacted,
  removeFromReserveList,
  inviteToEvent,
  endGuestAccess,
  makeGuestPermanent,
  promoteReserveToMember,
} from "./actions";

export default async function AdminReservaPage() {
  await requireOrganizer();
  const supabase = await createClient();

  const today = new Date().toISOString().slice(0, 10);

  const [{ data: rows }, { data: callableEvents }, { data: guestProfiles }] = await Promise.all([
    supabase
      .from("reserve_list")
      .select("id, auth_user_id, full_name, phone, neighborhood, contacted, created_at")
      .order("created_at", { ascending: true }),
    supabase
      .from("events")
      .select("id, date, location")
      .gte("date", today)
      .in("status", ["open", "teams_generated"])
      .order("date", { ascending: true }),
    supabase.from("profiles").select("id, guest_for_event_id").eq("status", "guest"),
  ]);

  const eventOptions = (callableEvents ?? []).map((e) => ({
    id: e.id,
    label: `${new Date(`${e.date}T00:00:00`).toLocaleDateString("pt-BR")}${e.location ? ` · ${e.location}` : ""}`,
  }));
  const eventLabelById = new Map(eventOptions.map((e) => [e.id, e.label]));
  const guestEventByAuthUserId = new Map((guestProfiles ?? []).map((g) => [g.id, g.guest_for_event_id]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Lista de reserva</h1>
        <p className="mt-1 text-sm text-white/60">
          Pessoas de fora do grupo que topam ser chamadas quando sobrar vaga de última hora num
          racha. Quem é chamado(a) ganha acesso ao site só pra esse racha, e volta pra reserva
          automaticamente depois que ele terminar.
        </p>
      </div>

      <ul className="divide-y divide-white/10 rounded-xl border border-white/10">
        {rows?.map((r) => {
          const guestEventId = guestEventByAuthUserId.get(r.auth_user_id);
          return (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="font-medium text-white">{r.full_name}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-sm text-white/60">
                  <Phone className="h-3.5 w-3.5" strokeWidth={2} />
                  {r.phone}
                </p>
                {r.neighborhood && (
                  <p className="mt-0.5 flex items-center gap-1.5 text-sm text-white/60">
                    <MapPin className="h-3.5 w-3.5" strokeWidth={2} />
                    {r.neighborhood}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {guestEventId ? (
                  <>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/15 px-3 py-1.5 text-xs font-medium text-blue-300">
                      <UserCheck className="h-3.5 w-3.5" strokeWidth={2} />
                      Chamado(a) pro racha de {eventLabelById.get(guestEventId) ?? "..."}
                    </span>
                    <MakePermanentButton
                      profileId={r.auth_user_id}
                      fullName={r.full_name}
                      action={makeGuestPermanent}
                    />
                    <EndGuestAccessButton
                      profileId={r.auth_user_id}
                      fullName={r.full_name}
                      action={endGuestAccess}
                    />
                  </>
                ) : (
                  <>
                    <InviteToEventForm action={inviteToEvent} reserveEntryId={r.id} events={eventOptions} />
                    <PromoteReserveButton
                      reserveEntryId={r.id}
                      fullName={r.full_name}
                      action={promoteReserveToMember}
                    />
                  </>
                )}
                <ActionForm
                  action={toggleContacted}
                  successMessage={r.contacted ? "Desmarcado." : "Marcado como já chamado!"}
                >
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="contacted" value={(!r.contacted).toString()} />
                  <button
                    type="submit"
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium ${
                      r.contacted
                        ? "border-green-500/30 bg-green-500/20 text-green-300"
                        : "border-white/15 bg-white/5 text-white/60 hover:bg-white/10"
                    }`}
                  >
                    {r.contacted ? (
                      <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} />
                    ) : (
                      <Circle className="h-3.5 w-3.5" strokeWidth={2} />
                    )}
                    {r.contacted ? "Já chamado" : "Marcar como chamado"}
                  </button>
                </ActionForm>
                <DeleteReserveEntryButton id={r.id} fullName={r.full_name} action={removeFromReserveList} />
              </div>
            </li>
          );
        })}
        {!rows?.length && (
          <li className="px-4 py-4 text-sm text-white/60">Ninguém na lista de reserva ainda.</li>
        )}
      </ul>
    </div>
  );
}
