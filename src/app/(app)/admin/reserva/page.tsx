import Link from "next/link";
import { SlidersHorizontal, AtSign, BadgeCheck, CalendarDays, CheckCircle2, Circle, MapPin, Phone, Search, UserCheck, UsersRound, Waypoints } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireOrganizer } from "@/lib/auth";
import { getActiveCommunity } from "@/lib/community";
import { todayStringInFortaleza } from "@/lib/today";
import { ActionForm } from "@/components/ActionForm";
import { Avatar } from "@/components/Avatar";
import { FormSelect } from "@/components/FormSelect";
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
  await requireOrganizer();
  const supabase = await createClient();
  const community = await getActiveCommunity();
  const filters = await searchParams;
  const today = todayStringInFortaleza();

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
  const member = single(filters.member);
  const tournaments = single(filters.tournaments);
  const shirt = single(filters.shirt);
  const heard = single(filters.heard);
  // Por padrão só aparece quem ainda não foi chamado; quem já foi chamado fica oculto na aba própria.
  const view = single(filters.view) === "called" ? "called" : single(filters.view) === "all" ? "all" : "pending";
  const neighborhoods = [...new Set((rows ?? []).map((row) => row.neighborhood?.trim()).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, "pt-BR"));

  const pendingCount = (rows ?? []).filter((row) => invitationCountFor(row) === 0).length;
  const calledCount = (rows ?? []).length - pendingCount;

  const matchesFilters = (row: NonNullable<typeof rows>[number]) => {
    const profile = profileById.get(row.auth_user_id);
    const searchable = `${row.full_name} ${row.instagram_handle ?? ""} ${row.phone} ${row.neighborhood ?? ""}`.toLocaleLowerCase("pt-BR");
    if (query && !searchable.includes(query)) return false;
    if (level && row.player_level !== level) return false;
    if (neighborhood && row.neighborhood !== neighborhood) return false;
    if (role === "setter" && !profile?.is_setter) return false;
    if (role === "attacker" && profile?.is_setter) return false;
    if (member === "yes" && row.wants_official_membership !== true) return false;
    if (member === "no" && row.wants_official_membership !== false) return false;
    if (tournaments === "yes" && profile?.wants_tournaments !== true) return false;
    if (tournaments === "no" && profile?.wants_tournaments !== false) return false;
    if (shirt === "yes" && profile?.has_vpa_shirt !== true) return false;
    if (shirt === "no" && profile?.has_vpa_shirt === true) return false;
    if (heard) {
      const text = (row.how_heard ?? "").toLocaleLowerCase("pt-BR");
      const fromInstagram = /insta/.test(text);
      const fromFriends = /amig|conhecid|colega|indica/.test(text);
      if (heard === "instagram" && !fromInstagram) return false;
      if (heard === "friends" && !fromFriends) return false;
      if (heard === "other" && (fromInstagram || fromFriends)) return false;
    }
    return true;
  };

  // Sempre do cadastro mais antigo pro mais novo, com quem ainda não foi chamado na frente.
  const filteredRows = (rows ?? [])
    .filter((row) => {
      const called = invitationCountFor(row) > 0;
      if (view === "pending" && called) return false;
      if (view === "called" && !called) return false;
      return matchesFilters(row);
    })
    .sort((a, b) => {
      const calledA = invitationCountFor(a) > 0 ? 1 : 0;
      const calledB = invitationCountFor(b) > 0 ? 1 : 0;
      return calledA - calledB || a.created_at.localeCompare(b.created_at);
    });

  const hasFilter = Boolean(query || level || neighborhood || role || member || tournaments || shirt || heard);
  const moreFiltersCount = [neighborhood, member, tournaments, shirt, heard].filter(Boolean).length;
  const hrefWith = (overrides: Record<string, string>) => {
    const params = new URLSearchParams();
    const next: Record<string, string> = { q: single(filters.q), level, neighborhood, role, member, tournaments, shirt, heard, view: view === "pending" ? "" : view, ...overrides };
    for (const [key, value] of Object.entries(next)) if (value) params.set(key, value);
    const text = params.toString();
    return text ? `/admin/reserva?${text}` : "/admin/reserva";
  };

  return (
    <div className="space-y-4">
      <header>
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-purple-300">Administração · Quadra</p>
        <h1 className="mt-0.5 text-2xl font-black text-white">Cadastros</h1>
      </header>

      <nav aria-label="Quem mostrar" className="grid grid-cols-3 gap-1 rounded-2xl border border-white/10 bg-white/[0.03] p-1">
        <ViewTab href={hrefWith({ view: "" })} active={view === "pending"} label="Para chamar" count={pendingCount} />
        <ViewTab href={hrefWith({ view: "called" })} active={view === "called"} label="Já chamados" count={calledCount} />
        <ViewTab href={hrefWith({ view: "all" })} active={view === "all"} label="Todos" count={rows?.length ?? 0} />
      </nav>
      <p className="-mt-1 px-1 text-[11px] text-white/45">
        {view === "pending" && "Do cadastro mais antigo para o mais novo. Quem já foi chamado fica escondido."}
        {view === "called" && "Quem já foi chamado ou marcado como contatado, do mais antigo para o mais novo."}
        {view === "all" && "Todos do mais antigo para o mais novo, com quem ainda não foi chamado na frente."}
      </p>

      <form action="/admin/reserva" method="get" className="space-y-2">
        {view !== "pending" && <input type="hidden" name="view" value={view} />}
        <div className="flex gap-2">
          <label className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
            <input name="q" defaultValue={single(filters.q)} placeholder="Nome, @, telefone ou bairro" className="min-h-11 w-full rounded-xl border border-white/15 bg-white/[0.03] pl-9 pr-3 text-sm text-white placeholder:text-white/35 transition focus:border-purple-300/50 focus:bg-white/[0.05] focus:shadow-[0_0_0_3px_rgba(196,181,253,0.14)] focus:outline-none" />
          </label>
          <button type="submit" className="min-h-11 rounded-xl bg-brand-purple px-4 text-sm font-semibold text-white hover:bg-brand-purple-dark">Buscar</button>
        </div>

        <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
          <QuickChip href={hrefWith({ role: role === "setter" ? "" : "setter" })} active={role === "setter"} label="Levantadores" />
          <QuickChip href={hrefWith({ role: role === "attacker" ? "" : "attacker" })} active={role === "attacker"} label="Não levantadores" />
          <QuickChip href={hrefWith({ member: member === "yes" ? "" : "yes" })} active={member === "yes"} label="Quer ser membro" />
          <QuickChip href={hrefWith({ tournaments: tournaments === "yes" ? "" : "yes" })} active={tournaments === "yes"} label="Quer torneios" />
          <QuickChip href={hrefWith({ level: level === "beginner" ? "" : "beginner" })} active={level === "beginner"} label="Iniciantes" />
          <QuickChip href={hrefWith({ level: level === "intermediate" ? "" : "intermediate" })} active={level === "intermediate"} label="Intermediários" />
          <QuickChip href={hrefWith({ level: level === "advanced" ? "" : "advanced" })} active={level === "advanced"} label="Avançados" />
          {hasFilter && <QuickChip href={hrefWith({ q: "", level: "", neighborhood: "", role: "", member: "", tournaments: "", shirt: "", heard: "" })} active={false} label="Limpar filtros" />}
        </div>

        <details className="rounded-xl border border-white/10 bg-white/[0.02]" open={moreFiltersCount > 0}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-xs font-semibold text-white/55">
            <span className="inline-flex items-center gap-1.5"><SlidersHorizontal className="h-3.5 w-3.5 text-purple-300" />Mais filtros{moreFiltersCount > 0 ? ` · ${moreFiltersCount}` : ""}</span>
            <span className="text-white/35">{filteredRows.length} pessoa{filteredRows.length === 1 ? "" : "s"}</span>
          </summary>
          <div className="grid gap-2 border-t border-white/10 p-3 sm:grid-cols-2 lg:grid-cols-4">
            <FilterSelect name="role" defaultValue={role} label="Qualquer função" options={[["setter", "Levantadores"], ["attacker", "Não levantadores"]]} />
            <FilterSelect name="level" defaultValue={level} label="Qualquer nível" options={[["beginner", "Iniciante"], ["intermediate", "Intermediário"], ["advanced", "Avançado"]]} />
            <FilterSelect name="neighborhood" defaultValue={neighborhood} label="Qualquer bairro" options={neighborhoods.map((item) => [item, item])} />
            <FilterSelect name="member" defaultValue={member} label="Membro: tanto faz" options={[["yes", "Quer ser membro"], ["no", "Não quer ser membro"]]} />
            <FilterSelect name="tournaments" defaultValue={tournaments} label="Torneios: tanto faz" options={[["yes", "Quer jogar torneios"], ["no", "Não quer torneios"]]} />
            <FilterSelect name="shirt" defaultValue={shirt} label="Camisa VPA: tanto faz" options={[["yes", "Tem camisa VPA"], ["no", "Não tem camisa VPA"]]} />
            <FilterSelect name="heard" defaultValue={heard} label="Conheceu por: qualquer" options={[["instagram", "Instagram"], ["friends", "Amigos e conhecidos"], ["other", "Outros"]]} />
            <div className="flex items-center justify-end gap-2">
              <Link href={hrefWith({ q: "", level: "", neighborhood: "", role: "", member: "", tournaments: "", shirt: "", heard: "" })} className="rounded-lg px-3 py-2 text-xs font-semibold text-white/55 hover:bg-white/5 hover:text-white">Limpar</Link>
              <button type="submit" className="min-h-10 rounded-lg bg-brand-purple px-4 py-2 text-sm font-semibold text-white hover:bg-brand-purple-dark">Filtrar</button>
            </div>
          </div>
        </details>
      </form>

      <ul className="grid gap-2.5 md:grid-cols-2">
        {filteredRows.map((row) => {
          const waitingProfile = profileById.get(row.auth_user_id);
          const guestEventId = waitingProfile?.guest_for_event_id;
          const invitationCount = invitationCountFor(row);
          return (
            <li key={row.id} className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
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
                <ActionForm action={toggleContacted} successMessage={row.contacted ? "Voltou para a lista de quem falta chamar." : "Marcado como chamado: saiu da lista de quem falta chamar."}>
                  <input type="hidden" name="id" value={row.id} />
                  <input type="hidden" name="contacted" value={(!row.contacted).toString()} />
                  <button type="submit" title={row.contacted ? "Já foi chamado (toque para desmarcar)" : "Marcar como chamado"} aria-label={row.contacted ? "Já foi chamado (toque para desmarcar)" : "Marcar como chamado"} className={`flex h-9 w-9 items-center justify-center rounded-full border ${row.contacted ? "border-green-500/30 bg-green-500/20 text-green-300" : "border-white/15 bg-white/5 text-white/50 hover:bg-white/10"}`}>{row.contacted ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}</button>
                </ActionForm>
                <DeleteReserveEntryButton id={row.id} fullName={row.full_name} action={removeFromReserveList} />
              </div>
            </li>
          );
        })}
        {!filteredRows.length && <li className="rounded-xl border border-white/10 px-4 py-8 text-center text-sm text-white/55 md:col-span-2">{view === "pending" && !hasFilter ? "Todo mundo da reserva já foi chamado. 🎉" : "Nenhuma pessoa corresponde ao que você escolheu."}</li>}
      </ul>
    </div>
  );
}

function ViewTab({ href, label, count, active }: { href: string; label: string; count: number; active: boolean }) {
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={`flex min-h-11 flex-col items-center justify-center rounded-xl px-1 text-center transition ${active ? "bg-gradient-to-br from-purple-500 to-violet-600 text-white shadow-md shadow-purple-950/30" : "text-white/55 hover:bg-white/5 hover:text-white"}`}>
      <strong className="text-base font-black leading-none tabular-nums">{count}</strong>
      <span className="mt-0.5 text-[10px] font-bold uppercase tracking-wide">{label}</span>
    </Link>
  );
}

function QuickChip({ href, label, active }: { href: string; label: string; active: boolean }) {
  return <Link href={href} className={`inline-flex min-h-8 shrink-0 items-center whitespace-nowrap rounded-full border px-3 text-[11.5px] font-bold transition ${active ? "border-purple-300/35 bg-purple-400/20 text-purple-50" : "border-white/10 bg-white/[0.035] text-white/55 hover:text-white"}`}>{label}</Link>;
}

function FilterSelect({ name, defaultValue, label, options, compact = false }: { name: string; defaultValue: string; label: string; options: string[][]; compact?: boolean }) {
  return (
    <FormSelect name={name} defaultValue={defaultValue} className={compact ? "min-h-8 py-1" : undefined}>
      <option value="">{label}</option>
      {options.map(([value, optionLabel]) => <option key={value} value={value}>{optionLabel}</option>)}
    </FormSelect>
  );
}
