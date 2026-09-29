import { Phone, MapPin, CheckCircle2, Circle, UserCheck, Waypoints, UsersRound, BadgeCheck, CalendarDays, AtSign } from "lucide-react";
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

  const [{ data: rows }, { data: callableEvents }, { data: waitingProfiles }] = await Promise.all([
    supabase
      .from("reserve_list")
      .select("id, auth_user_id, full_name, phone, instagram_handle, neighborhood, player_level, how_heard, known_people, wants_official_membership, contacted, created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("events")
      .select("id, date, location")
      .gte("date", today)
      .in("status", ["open", "teams_generated"])
      .order("date", { ascending: true }),
    supabase
      .from("profiles")
      .select("id, status, guest_for_event_id, birthdate, is_setter, attendance_frequency, has_vpa_shirt, wants_tournaments")
      .in("status", ["visitor", "guest"]),
  ]);

  const eventOptions = (callableEvents ?? []).map((e) => ({
    id: e.id,
    label: `${new Date(`${e.date}T00:00:00`).toLocaleDateString("pt-BR")}${e.location ? ` · ${e.location}` : ""}`,
  }));
  const eventLabelById = new Map(eventOptions.map((e) => [e.id, e.label]));
  const profileById = new Map((waitingProfiles ?? []).map((profile) => [profile.id, profile]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Cadastros e reserva</h1>
        <p className="mt-1 text-sm text-white/60">
          Esta é a única lista de pessoas novas. Autorize o acesso completo ou chame alguém somente
          para um racha. Depois do evento, o convidado volta ao modo de visualização.
        </p>
      </div>

      <ul className="grid gap-3">
        {rows?.map((r) => {
          const waitingProfile = profileById.get(r.auth_user_id);
          const guestEventId = waitingProfile?.guest_for_event_id;
          return (
            <li key={r.id} className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-white">{r.full_name}</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-white/60">
                    <span className="inline-flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{r.phone}</span>
                    {r.instagram_handle && <span className="inline-flex items-center gap-1.5"><AtSign className="h-3.5 w-3.5" />{r.instagram_handle}</span>}
                    {r.neighborhood && <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{r.neighborhood}</span>}
                    {waitingProfile?.birthdate && <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" />{new Date(`${waitingProfile.birthdate}T12:00:00`).toLocaleDateString("pt-BR")}</span>}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {r.player_level && <span className="rounded-full border border-purple-300/20 bg-purple-400/10 px-2.5 py-1 text-xs font-medium text-purple-200">{r.player_level === "beginner" ? "Iniciante" : r.player_level === "intermediate" ? "Intermediário" : "Avançado"}</span>}
                  {waitingProfile && <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/60">{waitingProfile.is_setter ? "Levantador(a)" : "Atacante"}</span>}
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${r.wants_official_membership === true ? "bg-green-500/15 text-green-300" : "bg-white/5 text-white/50"}`}>
                    <BadgeCheck className="h-3.5 w-3.5" />
                    {r.wants_official_membership === true ? "Quer ser membro" : r.wants_official_membership === false ? "Só quer conhecer" : "Interesse não informado"}
                  </span>
                </div>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <p className="flex items-start gap-2 rounded-xl bg-white/[0.035] p-3 text-sm text-white/65"><Waypoints className="mt-0.5 h-4 w-4 shrink-0 text-purple-300" /><span><strong className="block text-xs text-white/40">Conheceu por</strong>{r.how_heard ?? "Não informado"}</span></p>
                <p className="flex items-start gap-2 rounded-xl bg-white/[0.035] p-3 text-sm text-white/65"><UsersRound className="mt-0.5 h-4 w-4 shrink-0 text-purple-300" /><span><strong className="block text-xs text-white/40">Conhece no racha</strong>{r.known_people ?? "Não informado"}</span></p>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
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
        {!rows?.length && <li className="rounded-xl border border-white/10 px-4 py-4 text-sm text-white/60">Ninguém na lista geral ainda.</li>}
      </ul>
    </div>
  );
}
