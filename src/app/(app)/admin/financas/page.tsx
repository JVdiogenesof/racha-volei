import { CalendarCheck, Gift, History, RotateCcw, TicketCheck, UserRoundCheck, WalletCards, X } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireOrganizer } from "@/lib/auth";
import { COMMUNITY_INFO, getActiveCommunity } from "@/lib/community";
import { ActionForm } from "@/components/ActionForm";
import { Avatar } from "@/components/Avatar";
import { cancelFreeRachaCredit, grantFreeRachaCredits, restoreFreeRachaCredit, useFreeRachaCredit } from "./actions";

type ProfileRow = { id: string; full_name: string; avatar_url: string | null; status: string; communities: string[] | null };
type EventRow = { id: string; date: string; location: string | null; status: string };
type CreditStatus = "available" | "used" | "cancelled";
type CreditRow = {
  id: string;
  profile_id: string;
  reason: string;
  notes: string | null;
  status: CreditStatus;
  granted_by: string;
  granted_at: string;
  used_event_id: string | null;
  used_by: string | null;
  used_at: string | null;
  cancelled_by: string | null;
  cancelled_at: string | null;
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("pt-BR", { timeZone: "America/Fortaleza", day: "2-digit", month: "2-digit", year: "numeric" });
}

function eventLabel(event: EventRow) {
  const date = new Date(`${event.date}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
  return `${date}${event.location ? ` · ${event.location}` : ""}`;
}

export default async function AdminFinancasPage() {
  const organizer = await requireOrganizer();
  const community = await getActiveCommunity(organizer);
  const supabase = await createClient();
  const [{ data: profiles, error: profilesError }, { data: credits, error: creditsError }, { data: events, error: eventsError }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, avatar_url, status, communities").contains("communities", [community]).order("full_name"),
    supabase.from("free_racha_credits").select("id, profile_id, reason, notes, status, granted_by, granted_at, used_event_id, used_by, used_at, cancelled_by, cancelled_at").eq("community", community).order("granted_at", { ascending: false }),
    supabase.from("events").select("id, date, location, status").eq("community", community).neq("status", "cancelled").order("date", { ascending: false }).limit(16),
  ]);
  if (profilesError) throw new Error(profilesError.message);
  if (creditsError) throw new Error(creditsError.message);
  if (eventsError) throw new Error(eventsError.message);

  const profileRows = (profiles ?? []) as ProfileRow[];
  const creditRows = (credits ?? []) as CreditRow[];
  const eventRows = (events ?? []) as EventRow[];
  const profileById = new Map(profileRows.map((profile) => [profile.id, profile]));
  const eventById = new Map(eventRows.map((event) => [event.id, event]));
  const selectableProfiles = profileRows.filter((profile) => profile.status === "approved" || profile.status === "guest");
  const availableCredits = creditRows.filter((credit) => credit.status === "available");
  const historyCredits = creditRows.filter((credit) => credit.status !== "available").slice(0, 30);
  const availableByProfile = new Map<string, CreditRow[]>();
  for (const credit of availableCredits) {
    const current = availableByProfile.get(credit.profile_id) ?? [];
    current.push(credit);
    availableByProfile.set(credit.profile_id, current);
  }

  return (
    <div className="min-w-0">
      <header className="flex items-start gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-400/10 text-emerald-200"><WalletCards className="h-6 w-6" /></span>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-200/70">Controle interno · {COMMUNITY_INFO[community].shortLabel}</p>
          <h1 className="mt-1 text-2xl font-black text-white">Finanças e rachas gratuitos</h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-white/55">Registre cortesias, veja quem ainda possui entrada gratuita e marque quando ela for utilizada.</p>
        </div>
      </header>

      <section className="mt-6 grid grid-cols-3 gap-2 sm:gap-3">
        <StatCard icon={Gift} label="Disponíveis" value={availableCredits.length} accent="text-emerald-200" />
        <StatCard icon={UserRoundCheck} label="Pessoas" value={availableByProfile.size} accent="text-purple-200" />
        <StatCard icon={TicketCheck} label="Utilizados" value={creditRows.filter((credit) => credit.status === "used").length} accent="text-amber-200" />
      </section>

      <section className="mt-6 rounded-2xl border border-emerald-300/15 bg-emerald-400/[0.045] p-4 sm:p-5">
        <div className="flex items-center gap-2"><Gift className="h-5 w-5 text-emerald-200" /><h2 className="font-black text-white">Adicionar racha gratuito</h2></div>
        <ActionForm action={grantFreeRachaCredits} successMessage="Crédito gratuito registrado!" resetOnSuccess className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <label className="min-w-0 lg:col-span-2"><span className="mb-1.5 block text-xs font-semibold text-white/55">Pessoa</span><select name="profileId" required defaultValue="" className="min-h-11 w-full rounded-xl border border-white/10 bg-[#171039] px-3 text-sm text-white"><option value="" disabled>Escolha a pessoa</option>{selectableProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.full_name}</option>)}</select></label>
          <label className="min-w-0 lg:col-span-2"><span className="mb-1.5 block text-xs font-semibold text-white/55">Motivo</span><input name="reason" list="credit-reasons" required maxLength={120} placeholder="Ex.: prêmio do sorteio" className="min-h-11 w-full rounded-xl border border-white/10 bg-black/10 px-3 text-sm text-white placeholder:text-white/30" /><datalist id="credit-reasons"><option value="Premiação" /><option value="Sorteio" /><option value="Cortesia" /><option value="Compensação" /><option value="Convidado especial" /></datalist></label>
          <label><span className="mb-1.5 block text-xs font-semibold text-white/55">Quantidade</span><input type="number" name="quantity" min={1} max={10} defaultValue={1} required className="min-h-11 w-full rounded-xl border border-white/10 bg-black/10 px-3 text-sm text-white" /></label>
          <button type="submit" className="min-h-11 self-end rounded-xl bg-emerald-500 px-4 text-sm font-black text-emerald-950 hover:bg-emerald-400">Registrar</button>
          <label className="min-w-0 sm:col-span-2 lg:col-span-6"><span className="mb-1.5 block text-xs font-semibold text-white/55">Observação opcional</span><textarea name="notes" maxLength={500} rows={2} placeholder="Detalhes importantes para os administradores" className="w-full resize-y rounded-xl border border-white/10 bg-black/10 px-3 py-2.5 text-sm text-white placeholder:text-white/30" /></label>
        </ActionForm>
      </section>

      <section className="mt-6">
        <div className="flex items-center justify-between gap-3"><div><h2 className="font-black text-white">Créditos disponíveis</h2><p className="mt-1 text-xs text-white/45">Pessoas que ainda podem participar gratuitamente.</p></div><span className="rounded-full bg-emerald-400/10 px-3 py-1.5 text-xs font-black text-emerald-200">{availableCredits.length}</span></div>
        {availableByProfile.size ? <div className="mt-3 grid gap-3 lg:grid-cols-2">{[...availableByProfile.entries()].map(([profileId, playerCredits]) => {
          const player = profileById.get(profileId);
          return <article key={profileId} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
            <div className="flex items-center gap-3 border-b border-white/[0.07] p-4"><Avatar src={player?.avatar_url ?? null} name={player?.full_name ?? "Jogador"} size="md" /><div className="min-w-0 flex-1"><p className="truncate font-black text-white">{player?.full_name ?? "Perfil não encontrado"}</p><p className="mt-0.5 text-xs text-emerald-200">{playerCredits.length} {playerCredits.length === 1 ? "racha gratuito disponível" : "rachas gratuitos disponíveis"}</p></div></div>
            <div className="divide-y divide-white/[0.07]">{playerCredits.map((credit) => <div key={credit.id} className="p-4"><div className="flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-400/10 text-emerald-200"><Gift className="h-4 w-4" /></span><div className="min-w-0 flex-1"><p className="font-bold text-white">{credit.reason}</p><p className="mt-0.5 text-[11px] text-white/40">Concedido em {formatDate(credit.granted_at)}{profileById.get(credit.granted_by)?.full_name ? ` por ${profileById.get(credit.granted_by)?.full_name}` : ""}</p>{credit.notes && <p className="mt-2 rounded-lg bg-black/10 px-2.5 py-2 text-xs leading-5 text-white/55">{credit.notes}</p>}</div></div>
              <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                <ActionForm action={useFreeRachaCredit} successMessage={`${player?.full_name ?? "Pessoa"} utilizou o racha gratuito.`} className="flex min-w-0 gap-2"><input type="hidden" name="creditId" value={credit.id} /><select name="eventId" aria-label="Vincular ao racha" defaultValue="" className="min-h-10 min-w-0 flex-1 rounded-lg border border-white/10 bg-[#171039] px-2 text-xs text-white"><option value="">Usar sem vincular a um racha</option>{eventRows.map((event) => <option key={event.id} value={event.id}>{eventLabel(event)}</option>)}</select><button type="submit" className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg bg-emerald-500/15 px-3 text-xs font-bold text-emerald-200 hover:bg-emerald-500/25"><CalendarCheck className="h-4 w-4" />Usar</button></ActionForm>
                <ActionForm action={cancelFreeRachaCredit} successMessage="Crédito cancelado."><input type="hidden" name="creditId" value={credit.id} /><button type="submit" title="Cancelar crédito" aria-label="Cancelar crédito" className="grid h-10 w-10 place-items-center rounded-full border border-red-400/20 text-red-300 hover:bg-red-500/10"><X className="h-4 w-4" /></button></ActionForm>
              </div>
            </div>)}</div>
          </article>;
        })}</div> : <div className="mt-3 rounded-2xl border border-dashed border-white/10 p-8 text-center"><Gift className="mx-auto h-8 w-8 text-white/20" /><p className="mt-3 font-semibold text-white/60">Nenhum racha gratuito pendente.</p></div>}
      </section>

      <section className="mt-7 rounded-2xl border border-white/10 bg-white/[0.02]">
        <div className="flex items-center gap-2 border-b border-white/10 p-4"><History className="h-5 w-5 text-purple-300" /><div><h2 className="font-black text-white">Histórico recente</h2><p className="text-xs text-white/40">Créditos utilizados ou cancelados.</p></div></div>
        {historyCredits.length ? <div className="divide-y divide-white/[0.07]">{historyCredits.map((credit) => {
          const player = profileById.get(credit.profile_id);
          const event = credit.used_event_id ? eventById.get(credit.used_event_id) : null;
          return <article key={credit.id} className="flex min-w-0 flex-col gap-3 p-4 sm:flex-row sm:items-center"><div className="flex min-w-0 flex-1 items-center gap-3"><Avatar src={player?.avatar_url ?? null} name={player?.full_name ?? "Jogador"} size="sm" /><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-bold text-white">{player?.full_name ?? "Perfil não encontrado"}</p><span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${credit.status === "used" ? "bg-amber-300/10 text-amber-200" : "bg-red-400/10 text-red-200"}`}>{credit.status === "used" ? "Utilizado" : "Cancelado"}</span></div><p className="mt-1 text-xs text-white/45">{credit.reason}{event ? ` · ${eventLabel(event)}` : ""} · {formatDate(credit.used_at ?? credit.cancelled_at ?? credit.granted_at)}</p></div></div><ActionForm action={restoreFreeRachaCredit} successMessage="Crédito restaurado e disponível novamente."><input type="hidden" name="creditId" value={credit.id} /><input type="hidden" name="previousStatus" value={credit.status} /><button type="submit" className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-white/10 px-3 text-xs font-semibold text-white/60 hover:bg-white/5 hover:text-white"><RotateCcw className="h-3.5 w-3.5" />Restaurar</button></ActionForm></article>;
        })}</div> : <p className="p-6 text-center text-sm text-white/35">O histórico aparecerá quando um crédito for usado ou cancelado.</p>}
      </section>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent }: { icon: typeof Gift; label: string; value: number; accent: string }) {
  return <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4"><Icon className={`h-5 w-5 ${accent}`} /><strong className="mt-2 block text-xl text-white sm:text-2xl">{value}</strong><span className="mt-1 block text-[9px] font-semibold uppercase leading-tight tracking-wide text-white/40 sm:text-[10px]">{label}</span></div>;
}
