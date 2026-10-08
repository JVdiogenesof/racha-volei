import Link from "next/link";
import { AtSign, BadgeCheck, CalendarDays, CheckCircle2, Circle, MapPin, Phone, Search, UserCheck, UsersRound, Waypoints } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireOrganizer } from "@/lib/auth";
import { getActiveCommunity } from "@/lib/community";
import { ActionForm } from "@/components/ActionForm";
import { Avatar } from "@/components/Avatar";
import { DeleteReserveEntryButton } from "@/components/DeleteReserveEntryButton";
import { EndGuestAccessButton } from "@/components/EndGuestAccessButton";
import { InviteToEventForm } from "@/components/InviteToEventForm";
import { MakePermanentButton } from "@/components/MakePermanentButton";
import { PromoteReserveButton } from "@/components/PromoteReserveButton";
import { endGuestAccess, inviteToEvent, makeGuestPermanent, promoteReserveToMember, removeFromReserveList, toggleContacted } from "./actions";

type PageSearchParams = Promise<Record<string, string | string[] | undefined>>;

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function levelLabel(level: string | null) {
  if (level === "beginner") return "Iniciante";
  if (level === "intermediate") return "Intermediário";
  if (level === "advanced") return "Avançado";
  return "Nível não informado";
}

export default async function AdminReservaPage({ searchParams }: { searchParams: PageSearchParams }) {
  const organizer = await requireOrganizer();
  const supabase = await createClient();
  const community = await getActiveCommunity(organizer);
  const filters = await searchParams;
  const today = new Date().toISOString().slice(0, 10);

  const [{ data: rows }, { data: callableEvents }, { data: waitingProfiles }, { data: invitationRows }] = await Promise.all([
    supabase.from("reserve_list").select("id, auth_user_id, full_name, phone, instagram_handle, neighborhood, player_level, communities, how_heard, known_people, wants_official_membership, contacted, created_at").contains("communities", [community]).order("created_at", { ascending: false }),
    supabase.from("events").select("id, date, location").eq("community", community).gte("date", today).in("status", ["open", "teams_generated"]).order("date", { ascending: true }),
    supabase.from("profiles").select("id, status, guest_for_event_id, birthdate, avatar_url, is_setter, attendance_frequency, has_vpa_shirt, wants_tournaments, communities").in("status", ["visitor", "guest"]),
    supabase.from("reserve_invitations").select("reserve_entry_id, event_id, invited_at"),
  ]);

  const eventOptions = (callableEvents ?? []).map((event) => ({
    id: event.id,
    label: `${new Date(`${event.date}T00:00:00`).toLocaleDateString("pt-BR")}${event.location ? ` · ${event.location}` : ""}`,
  }));
  const eventLabelById = new Map(eventOptions.map((event) => [event.id, event.label]));
  const profileById = new Map((waitingProfiles ?? []).map((profile) => [profile.id, profile]));
  const invitationCountByReserveId = new Map<string, number>();
  for (const invitation of invitationRows ?? []) {
    invitationCountByReserveId.set(invitation.reserve_entry_id, (invitationCountByReserveId.get(invitation.reserve_entry_id) ?? 0) + 1);
  }
  const invitationCountFor = (row: { id: string; contacted: boolean }) =>
    Math.max(invitationCountByReserveId.get(row.id) ?? 0, row.contacted ? 1 : 0);

  const query = single(filters.q).trim().toLocaleLowerCase("pt-BR");
  const level = single(filters.level);
  const neighborhood = single(filters.neighborhood);
  const role = single(filters.role);
  const invitations = single(filters.invitations);
  const sort = single(filters.sort) || "recent";
  const neighborhoods = [...new Set((rows ?? []).map((row) => row.neighborhood?.trim()).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, "pt-BR"));

  const filteredRows = (rows ?? []).filter((row) => {
    const profile = profileById.get(row.auth_user_id);
    const invitationCount = invitationCountFor(row);
    const searchable = `${row.full_name} ${row.instagram_handle ?? ""} ${row.phone} ${row.neighborhood ?? ""}`.toLocaleLowerCase("pt-BR");
    if (query && !searchable.includes(query)) return false;
    if (level && row.player_level !== level) return false;
    if (neighborhood && row.neighborhood !== neighborhood) return false;
    if (role === "setter" && !profile?.is_setter) return false;
    if (role === "attacker" && profile?.is_setter) return false;
    if (invitations === "never" && invitationCount !== 0) return false;
    if (invitations === "once" && invitationCount !== 1) return false;
    if (invitations === "multiple" && invitationCount < 2) return false;
    return true;
  }).sort((a, b) => {
    if (sort === "oldest") return a.created_at.localeCompare(b.created_at);
    if (sort === "name") return a.full_name.localeCompare(b.full_name, "pt-BR");
    if (sort === "most_invited") return invitationCountFor(b) - invitationCountFor(a) || b.created_at.localeCompare(a.created_at);
    return b.created_at.localeCompare(a.created_at);
  });

  const neverInvitedCount = (rows ?? []).filter((row) => invitationCountFor(row) === 0).length;
  const totalInvitations = (rows ?? []).reduce((total, row) => total + invitationCountFor(row), 0);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-white">Cadastros · {community === "sand" ? "Areia" : "Quadra"}</h1>
        <p className="mt-1 text-sm text-white/55">Encontre, compare e chame pessoas da reserva sem perder o histórico.</p>
      </div>

      <section className="grid grid-cols-3 gap-2">
        <SummaryStat label="Na reserva" value={rows?.length ?? 0} />
        <SummaryStat label="Nunca chamados" value={neverInvitedCount} />
        <SummaryStat label="Convites feitos" value={totalInvitations} />
      </section>

      <form action="/admin/reserva" method="get" className="rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
          <label className="relative sm:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
            <input name="q" defaultValue={single(filters.q)} placeholder="Nome, @, telefone ou bairro" className="min-h-11 w-full rounded-xl border border-white/10 bg-black/10 pl-9 pr-3 text-sm text-white placeholder:text-white/35" />
          </label>
          <FilterSelect name="level" defaultValue={level} label="Todos os níveis" options={[["beginner", "Iniciante"], ["intermediate", "Intermediário"], ["advanced", "Avançado"]]} />
          <FilterSelect name="neighborhood" defaultValue={neighborhood} label="Todos os bairros" options={neighborhoods.map((item) => [item, item])} />
          <FilterSelect name="role" defaultValue={role} label="Todas as funções" options={[["setter", "Levantadores"], ["attacker", "Não levantadores"]]} />
          <FilterSelect name="invitations" defaultValue={invitations} label="Todos os convites" options={[["never", "Nunca chamado"], ["once", "Chamado 1 vez"], ["multiple", "Chamado 2+ vezes"]]} />
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <FilterSelect name="sort" defaultValue={sort} label="Mais recentes" options={[["oldest", "Mais antigos"], ["name", "Ordem alfabética"], ["most_invited", "Mais chamados"]]} compact />
            <span className="text-xs text-white/40">{filteredRows.length} resultado{filteredRows.length === 1 ? "" : "s"}</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/admin/reserva" className="rounded-lg px-3 py-2 text-xs font-semibold text-white/55 hover:bg-white/5 hover:text-white">Limpar</Link>
            <button type="submit" className="min-h-10 rounded-lg bg-brand-purple px-4 py-2 text-sm font-semibold text-white hover:bg-brand-purple-dark">Filtrar</button>
          </div>
        </div>
      </form>

      <ul className="grid gap-3 md:grid-cols-2">
        {filteredRows.map((row) => {
          const waitingProfile = profileById.get(row.auth_user_id);
          const guestEventId = waitingProfile?.guest_for_event_id;
          const invitationCount = invitationCountFor(row);
          return (
            <li key={row.id} className="rounded-2xl border border-white/10 bg-white/[0.025] p-3 sm:p-4">
              <div className="flex min-w-0 items-start gap-3">
                <Avatar src={waitingProfile?.avatar_url} name={row.full_name} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                    <p className="min-w-0 flex-1 truncate font-bold text-white">{row.full_name}</p>
                    <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${invitationCount > 0 ? "bg-blue-500/15 text-blue-200" : "bg-white/5 text-white/40"}`}>{invitationCount} {invitationCount === 1 ? "convite" : "convites"}</span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px]">
                    <span className="rounded-full bg-purple-400/10 px-2 py-1 text-purple-200">{levelLabel(row.player_level)}</span>
                    <span className="rounded-full bg-white/5 px-2 py-1 text-white/55">{waitingProfile?.is_setter ? "Levantador(a)" : "Não levantador(a)"}</span>
                    {row.neighborhood && <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-1 text-white/55"><MapPin className="h-3 w-3" />{row.neighborhood}</span>}
                    {row.wants_official_membership === true && <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-1 text-green-300"><BadgeCheck className="h-3 w-3" />Quer ser membro</span>}
                  </div>
                </div>
              </div>

              <div className="mt-3 grid gap-1.5 border-t border-white/8 pt-2.5 text-xs text-white/50 sm:grid-cols-2">
                <span className="inline-flex min-w-0 items-center gap-1"><Phone className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{row.phone}</span></span>
                {row.instagram_handle && <span className="inline-flex min-w-0 items-center gap-1"><AtSign className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{row.instagram_handle}</span></span>}
              </div>

              <details className="group mt-2 rounded-xl bg-white/[0.025] px-3 py-2">
                <summary className="cursor-pointer list-none text-xs font-semibold text-white/45 hover:text-white/70">Ver informações do cadastro</summary>
                <div className="mt-2 grid gap-2 text-xs text-white/55 sm:grid-cols-2">
                  <p className="flex gap-2"><Waypoints className="h-4 w-4 shrink-0 text-purple-300" /><span><strong className="block text-[10px] text-white/35">Conheceu por</strong>{row.how_heard ?? "Não informado"}</span></p>
                  <p className="flex gap-2"><UsersRound className="h-4 w-4 shrink-0 text-purple-300" /><span><strong className="block text-[10px] text-white/35">Conhece no racha</strong>{row.known_people ?? "Não informado"}</span></p>
                  {waitingProfile?.birthdate && <p className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-purple-300" />Nascimento: {new Date(`${waitingProfile.birthdate}T12:00:00`).toLocaleDateString("pt-BR")}</p>}
                  <p>Cadastro: {new Date(row.created_at).toLocaleDateString("pt-BR")}</p>
                </div>
              </details>

              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/8 pt-3">
                {guestEventId ? (
                  <>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/15 px-2.5 py-1.5 text-xs font-medium text-blue-300"><UserCheck className="h-3.5 w-3.5" />{eventLabelById.get(guestEventId) ?? "Racha atual"}</span>
                    <MakePermanentButton profileId={row.auth_user_id} fullName={row.full_name} action={makeGuestPermanent} />
                    <EndGuestAccessButton profileId={row.auth_user_id} fullName={row.full_name} action={endGuestAccess} />
                  </>
                ) : (
                  <>
                    <InviteToEventForm action={inviteToEvent} reserveEntryId={row.id} events={eventOptions} />
                    <PromoteReserveButton reserveEntryId={row.id} fullName={row.full_name} action={promoteReserveToMember} />
                  </>
                )}
                <ActionForm action={toggleContacted} successMessage={row.contacted ? "Desmarcado." : "Marcado como contatado!"}>
                  <input type="hidden" name="id" value={row.id} />
                  <input type="hidden" name="contacted" value={(!row.contacted).toString()} />
                  <button type="submit" title={row.contacted ? "Já foi contatado" : "Marcar como contatado"} aria-label={row.contacted ? "Já foi contatado" : "Marcar como contatado"} className={`flex h-9 w-9 items-center justify-center rounded-full border ${row.contacted ? "border-green-500/30 bg-green-500/20 text-green-300" : "border-white/15 bg-white/5 text-white/50 hover:bg-white/10"}`}>{row.contacted ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}</button>
                </ActionForm>
                <DeleteReserveEntryButton id={row.id} fullName={row.full_name} action={removeFromReserveList} />
              </div>
            </li>
          );
        })}
        {!filteredRows.length && <li className="rounded-xl border border-white/10 px-4 py-8 text-center text-sm text-white/55 md:col-span-2">Nenhuma pessoa corresponde aos filtros escolhidos.</li>}
      </ul>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2.5 text-center"><strong className="block text-lg text-white">{value}</strong><span className="text-[10px] font-semibold uppercase tracking-wide text-white/40">{label}</span></div>;
}

function FilterSelect({ name, defaultValue, label, options, compact = false }: { name: string; defaultValue: string; label: string; options: string[][]; compact?: boolean }) {
  return (
    <select name={name} defaultValue={defaultValue} className={`${compact ? "min-h-10" : "min-h-11 w-full"} rounded-xl border border-white/10 bg-[#1c1233] px-3 text-sm text-white/75`}>
      <option value="">{label}</option>
      {options.map(([value, optionLabel]) => <option key={value} value={value}>{optionLabel}</option>)}
    </select>
  );
}
