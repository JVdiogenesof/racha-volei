import Link from "next/link";
import { Award, BarChart3, Bell, CalendarPlus, ChevronRight, Clock, MapPin, Phone, Shirt, Users, WalletCards, UserRoundX, type LucideIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireOrganizer } from "@/lib/auth";
import { COMMUNITY_INFO, getActiveCommunity } from "@/lib/community";
import { todayStringInFortaleza } from "@/lib/today";

function formatDay(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
}

export default async function AdminPainelPage() {
  const organizer = await requireOrganizer();
  const supabase = await createClient();
  const community = await getActiveCommunity(organizer);
  const today = todayStringInFortaleza();

  const [{ data: nextEvents }, reserve, neverContacted, shirts, reminders] = await Promise.all([
    supabase
      .from("events")
      .select("id, date, time, location, num_teams, team_size, max_players, status, is_pre_torneio, registration_opens_at")
      .eq("community", community)
      .gte("date", today)
      .in("status", ["open", "teams_generated"])
      .order("date", { ascending: true })
      .limit(1),
    supabase.from("reserve_list").select("id", { count: "exact", head: true }).contains("communities", [community]),
    supabase.from("reserve_list").select("id", { count: "exact", head: true }).contains("communities", [community]).eq("contacted", false),
    supabase.from("shirt_orders").select("id", { count: "exact", head: true }).eq("community", community).eq("paid", false),
    supabase.from("finance_reminders").select("id, title, due_date").eq("community", community).eq("completed", false).order("due_date", { ascending: true, nullsFirst: false }).limit(3),
  ]);

  const next = nextEvents?.[0] ?? null;
  let confirmed = 0;
  if (next) {
    const { count } = await supabase.from("attendance").select("id", { count: "exact", head: true }).eq("event_id", next.id).eq("status", "confirmed");
    confirmed = count ?? 0;
  }
  const capacity = next ? next.max_players ?? next.num_teams * next.team_size : 0;
  const fill = capacity > 0 ? Math.min(100, Math.round((confirmed / capacity) * 100)) : 0;
  const opensLater = next?.registration_opens_at && new Date(next.registration_opens_at) > new Date();

  const pending: { href: string; icon: LucideIcon; title: string; detail: string; tone: string }[] = [];
  if ((neverContacted.count ?? 0) > 0) pending.push({ href: "/admin/reserva?invitations=never", icon: Phone, title: `${neverContacted.count} ${neverContacted.count === 1 ? "cadastro nunca chamado" : "cadastros nunca chamados"}`, detail: "Chame antes do próximo racha", tone: "text-emerald-300" });
  if ((shirts.count ?? 0) > 0) pending.push({ href: "/admin/camisas", icon: Shirt, title: `${shirts.count} ${shirts.count === 1 ? "pedido de camisa" : "pedidos de camisa"} sem pagamento completo`, detail: "Veja pendentes e parciais", tone: "text-amber-300" });
  for (const reminder of reminders.data ?? []) {
    pending.push({ href: "/admin/financas", icon: Bell, title: reminder.title, detail: reminder.due_date ? `Prazo ${formatDay(reminder.due_date)}` : "Agenda financeira", tone: "text-amber-300" });
  }

  const shortcuts: { href: string; icon: LucideIcon; title: string; detail: string }[] = [
    { href: "/racha", icon: CalendarPlus, title: "Criar racha", detail: "Agora na aba Rachas" },
    { href: "/admin/ranking", icon: Award, title: "Ajustar ranking", detail: "Corrigir presença e vitórias" },
    { href: "/admin/financas", icon: WalletCards, title: "Finanças", detail: "Caixa e saldos" },
    { href: "/admin/atividade", icon: UserRoundX, title: "Atividade", detail: "Presenças e tempo sem ir" },
    { href: "/admin/resumo", icon: BarChart3, title: "Resumo mensal", detail: "Artes prontas pra postar" },
  ];

  return (
    <div className="space-y-4">
      <header>
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-purple-300">Administração · {COMMUNITY_INFO[community].shortLabel}</p>
        <h1 className="mt-0.5 text-2xl font-black text-white">Painel</h1>
      </header>

      <section className="grid gap-2.5 rounded-2xl border border-purple-300/20 bg-gradient-to-br from-[#51339a] via-[#2f205e] to-[#171136] p-3.5">
        {next ? (
          <>
            <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
              <span className="rounded-full bg-white/12 px-2 py-1 text-purple-100">Próximo racha</span>
              {next.is_pre_torneio && <span className="rounded-full bg-amber-300/15 px-2 py-1 text-amber-200">Pré-torneio</span>}
              {opensLater && <span className="ml-auto rounded-full bg-amber-300/15 px-2 py-1 text-amber-200">Inscrição ainda não abriu</span>}
            </div>
            <p className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-white">
              <strong className="text-lg font-black capitalize">{formatDay(next.date)}{next.time ? ` · ${next.time.slice(0, 5)}` : ""}</strong>
              {next.location && <span className="inline-flex items-center gap-1 text-xs text-white/60"><MapPin className="h-3.5 w-3.5" />{next.location}</span>}
            </p>
            <div>
              <div className="mb-1.5 flex items-center justify-between text-xs text-white/60"><span>Lista confirmada</span><strong className="text-white">{confirmed}{capacity ? ` / ${capacity}` : ""}</strong></div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-violet-400 to-purple-200" style={{ width: `${fill}%` }} /></div>
            </div>
            <div className="flex gap-2">
              <Link href={`/racha/${next.id}`} className="flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-purple px-3 text-sm font-bold text-white hover:bg-brand-purple-dark"><Users className="h-4 w-4" />Gerenciar lista</Link>
              <Link href="/racha" className="flex min-h-10 items-center justify-center rounded-xl border border-white/15 px-3 text-sm font-semibold text-white/80 hover:bg-white/5">Rachas</Link>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10 text-purple-100"><Clock className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1"><p className="font-bold text-white">Nenhum racha agendado</p><p className="text-xs text-white/55">Crie o próximo racha pra abrir a lista.</p></div>
            <Link href="/racha" className="flex min-h-10 shrink-0 items-center rounded-xl bg-brand-purple px-3 text-sm font-bold text-white">Criar</Link>
          </div>
        )}
      </section>

      <section className="grid grid-cols-3 gap-1.5">
        <Tile label="Na reserva" value={reserve.count ?? 0} href="/admin/reserva" />
        <Tile label="Nunca chamados" value={neverContacted.count ?? 0} href="/admin/reserva?invitations=never" warn />
        <Tile label="Camisas a receber" value={shirts.count ?? 0} href="/admin/camisas" warn />
      </section>

      <section className="space-y-1.5">
        <h2 className="px-0.5 text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-white/40">Pendências</h2>
        {pending.length ? pending.map((item, index) => (
          <Link key={`${item.href}-${index}`} href={item.href} className="flex min-w-0 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-2.5 transition hover:bg-white/[0.06]">
            <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white/[0.07] ${item.tone}`}><item.icon className="h-4 w-4" /></span>
            <span className="min-w-0 flex-1"><strong className="block truncate text-[13px] text-white">{item.title}</strong><span className="block truncate text-[11px] text-white/50">{item.detail}</span></span>
            <ChevronRight className="h-4 w-4 shrink-0 text-white/30" />
          </Link>
        )) : <p className="rounded-2xl border border-white/10 px-3 py-4 text-center text-sm text-white/50">Tudo em dia por aqui.</p>}
      </section>

      <section className="space-y-1.5">
        <h2 className="px-0.5 text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-white/40">Atalhos</h2>
        <div className="grid grid-cols-2 gap-2">
          {shortcuts.map((item) => (
            <Link key={item.href} href={item.href} className="grid min-w-0 gap-2 rounded-2xl border border-white/10 bg-white/[0.035] p-3 transition hover:bg-white/[0.06]">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-purple-400/15 text-purple-200"><item.icon className="h-4 w-4" /></span>
              <span><strong className="block text-[13px] text-white">{item.title}</strong><span className="block text-[11px] leading-snug text-white/50">{item.detail}</span></span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function Tile({ label, value, href, warn = false }: { label: string; value: number; href: string; warn?: boolean }) {
  return (
    <Link href={href} className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.035] px-1.5 py-2 text-center transition hover:bg-white/[0.06]">
      <strong className={`block text-lg font-black leading-tight tabular-nums ${warn && value > 0 ? "text-amber-300" : "text-white"}`}>{value}</strong>
      <span className="block text-[9px] font-bold uppercase tracking-wide text-white/40">{label}</span>
    </Link>
  );
}
