import { ArrowDownRight, ArrowUpRight, CalendarClock, Check, CircleDollarSign, ClipboardCheck, History, RotateCcw, WalletCards, X } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireOrganizer } from "@/lib/auth";
import { COMMUNITY_INFO, getActiveCommunity } from "@/lib/community";
import { ActionForm } from "@/components/ActionForm";
import { Avatar } from "@/components/Avatar";
import { PlayerBalanceForm } from "@/components/PlayerBalanceForm";
import { AnimatedMetric } from "@/components/AnimatedMetric";
import { addFinanceReminder, addFinanceTransaction, addPlayerBalance, applyPlayerBalance, reversePlayerBalance, toggleFinanceReminder, voidFinanceTransaction } from "./actions";

type ProfileRow = { id: string; full_name: string; avatar_url: string | null; status: string };
type EventRow = { id: string; date: string; location: string | null; price_per_player: string | number | null };
type BalanceRow = { id: string; profile_id: string; entry_type: "credit" | "debit"; amount: string | number; category: string; cash_effect: string; description: string; notes: string | null; event_id: string | null; created_at: string; reversed_at: string | null };
type TransactionRow = { id: string; transaction_type: "income" | "expense"; category: string; description: string; amount: string | number; transaction_date: string; profile_id: string | null; event_id: string | null; payment_id: string | null; balance_entry_id: string | null; notes: string | null; voided_at: string | null };
type ReminderRow = { id: string; title: string; notes: string | null; due_date: string | null; completed: boolean; created_at: string };

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const categoryLabels: Record<string, string> = {
  event_payment: "Pagamento do racha", sponsorship: "Patrocínio", court_rental: "Aluguel da quadra",
  medals: "Medalhas", balance: "Saldo de jogador", other: "Outro",
  advance_payment: "Pagamento antecipado", cancellation_credit: "Desistência avisada",
  challenge: "Prêmio de desafio",
};

function amount(value: string | number) { return Number(value) || 0; }
function formatDate(value: string) { return new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }); }
function formatMonth(value: string) { const [year, month] = value.split("-"); return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }); }
function eventLabel(event: EventRow) { return `${formatDate(event.date)}${event.location ? ` · ${event.location}` : ""}${event.price_per_player ? ` · ${money.format(amount(event.price_per_player))}` : ""}`; }

export default async function AdminFinancasPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const organizer = await requireOrganizer();
  const community = await getActiveCommunity(organizer);
  const supabase = await createClient();
  const requestedMonth = (await searchParams).month;
  const currentDate = new Date();
  const currentMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}`;
  const selectedMonth = requestedMonth && /^\d{4}-\d{2}$/.test(requestedMonth) ? requestedMonth : currentMonth;
  const [profilesResult, balancesResult, transactionsResult, remindersResult, eventsResult] = await Promise.all([
    supabase.from("profiles").select("id, full_name, avatar_url, status").contains("communities", [community]).order("full_name"),
    supabase.from("player_balance_entries").select("id, profile_id, entry_type, amount, category, cash_effect, description, notes, event_id, created_at, reversed_at").eq("community", community).order("created_at", { ascending: false }),
    supabase.from("finance_transactions").select("id, transaction_type, category, description, amount, transaction_date, profile_id, event_id, payment_id, balance_entry_id, notes, voided_at").eq("community", community).order("transaction_date", { ascending: false }).order("created_at", { ascending: false }).limit(1000),
    supabase.from("finance_reminders").select("id, title, notes, due_date, completed, created_at").eq("community", community).order("completed").order("due_date", { ascending: true, nullsFirst: false }).limit(60),
    supabase.from("events").select("id, date, location, price_per_player").eq("community", community).neq("status", "cancelled").order("date", { ascending: false }).limit(120),
  ]);
  for (const result of [profilesResult, balancesResult, transactionsResult, remindersResult, eventsResult]) if (result.error) throw new Error(result.error.message);

  const profiles = (profilesResult.data ?? []) as ProfileRow[];
  const balanceRows = (balancesResult.data ?? []) as BalanceRow[];
  const transactionRows = (transactionsResult.data ?? []) as TransactionRow[];
  const reminders = (remindersResult.data ?? []) as ReminderRow[];
  const events = (eventsResult.data ?? []) as EventRow[];
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const eventById = new Map(events.map((event) => [event.id, event]));
  const selectableProfiles = profiles.filter((profile) => profile.status === "approved" || profile.status === "guest");

  const activeTransactions = transactionRows.filter((row) => !row.voided_at);
  const monthTransactions = activeTransactions.filter((row) => row.transaction_date.startsWith(selectedMonth));
  const displayTransactions = transactionRows.filter((row) => row.transaction_date.startsWith(selectedMonth));
  const monthIncome = monthTransactions.filter((row) => row.transaction_type === "income").reduce((sum, row) => sum + amount(row.amount), 0);
  const monthExpense = monthTransactions.filter((row) => row.transaction_type === "expense").reduce((sum, row) => sum + amount(row.amount), 0);
  const cashTotal = activeTransactions.reduce((sum, row) => sum + (row.transaction_type === "income" ? amount(row.amount) : -amount(row.amount)), 0);

  const entriesByProfile = new Map<string, BalanceRow[]>();
  const balanceByProfile = new Map<string, number>();
  for (const entry of balanceRows.filter((row) => !row.reversed_at)) {
    entriesByProfile.set(entry.profile_id, [...(entriesByProfile.get(entry.profile_id) ?? []), entry]);
    balanceByProfile.set(entry.profile_id, (balanceByProfile.get(entry.profile_id) ?? 0) + (entry.entry_type === "credit" ? amount(entry.amount) : -amount(entry.amount)));
  }
  const holders = [...balanceByProfile.entries()].filter(([, value]) => value > 0.009).sort((a, b) => b[1] - a[1]);
  const totalPlayerBalance = holders.reduce((sum, [, value]) => sum + value, 0);
  const monthEvents = events.filter((event) => event.date.startsWith(selectedMonth));
  const availableMonths = [...new Set([...activeTransactions.map((row) => row.transaction_date.slice(0, 7)), ...events.map((event) => event.date.slice(0, 7)), currentMonth])].sort().reverse();
  const today = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}-${String(currentDate.getDate()).padStart(2, "0")}`;

  return <div className="min-w-0 pb-10">
    <header className="flex items-start gap-3">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-400/10 text-emerald-200"><WalletCards className="h-6 w-6" /></span>
      <div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-200/70">Controle interno · {COMMUNITY_INFO[community].shortLabel}</p><h1 className="mt-1 text-2xl font-black text-white">Caixa e saldos</h1><p className="mt-1 max-w-2xl text-sm leading-6 text-white/55">Entradas, despesas, saldo antecipado das pessoas e lembretes dos administradores.</p></div>
    </header>

    <section className="relative mt-5 overflow-hidden rounded-3xl border border-emerald-300/20 bg-gradient-to-br from-emerald-400/15 via-cyan-400/[0.06] to-purple-500/10 p-5 shadow-lg shadow-emerald-950/10 sm:p-6">
      <div className="absolute -right-8 -top-10 h-32 w-32 rounded-full bg-emerald-300/10 blur-2xl" />
      <div className="relative flex items-center gap-4"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-400/15 text-emerald-200"><CircleDollarSign className="h-6 w-6" /></span><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-200/65">Total no caixa geral agora</p><strong className={`mt-1 block truncate text-3xl font-black sm:text-4xl ${cashTotal >= 0 ? "text-white" : "text-red-200"}`}>{money.format(cashTotal)}</strong><p className="mt-1 text-xs text-white/45">Atualizado com pagamentos, patrocínios, saldos e despesas. Camisas ficam em outro caixa.</p></div></div>
    </section>

    <form method="get" className="mt-5 flex items-end gap-2 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:max-w-md">
      <label className="min-w-0 flex-1"><span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-white/40">Mês da leitura</span><select name="month" defaultValue={selectedMonth} className="field capitalize">{availableMonths.map((month) => <option key={month} value={month}>{formatMonth(month)}</option>)}</select></label>
      <button type="submit" className="min-h-11 rounded-xl bg-purple-500 px-4 text-xs font-black text-white hover:bg-purple-400">Filtrar</button>
    </form>

    <section className="mt-6 grid grid-cols-2 gap-2 lg:grid-cols-4">
      <Stat icon={ArrowUpRight} label="Entradas" value={money.format(monthIncome)} color="text-emerald-300" />
      <Stat icon={ArrowDownRight} label="Saídas" value={money.format(monthExpense)} color="text-red-300" />
      <Stat icon={CircleDollarSign} label="Saldo" value={money.format(monthIncome - monthExpense)} color={monthIncome - monthExpense >= 0 ? "text-cyan-200" : "text-red-300"} />
      <Stat icon={WalletCards} label="Resumo" value={`${monthEvents.length} ${monthEvents.length === 1 ? "racha" : "rachas"}`} color="text-purple-200" />
    </section>

    <section className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025]">
      <div className="border-b border-white/10 p-4"><h2 className="font-black capitalize text-white">Resumo de {formatMonth(selectedMonth)}</h2><p className="mt-1 text-xs text-white/45">A sobra de cada racha é o que entrou menos as despesas vinculadas a ele.</p></div>
      {monthEvents.length ? <div className="divide-y divide-white/[0.07]">{monthEvents.map((event) => {
        const eventTransactions = activeTransactions.filter((row) => row.event_id === event.id);
        const income = eventTransactions.filter((row) => row.transaction_type === "income").reduce((sum, row) => sum + amount(row.amount), 0);
        const expense = eventTransactions.filter((row) => row.transaction_type === "expense").reduce((sum, row) => sum + amount(row.amount), 0);
        const paidCount = eventTransactions.filter((row) => row.category === "event_payment" && row.transaction_type === "income").length;
        const surplus = income - expense;
        return <article key={event.id} className="p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-bold text-white">Racha de {formatDate(event.date)}</p><p className="mt-0.5 text-xs text-white/40">{event.location ?? "Local não informado"} · {paidCount} pagamentos registrados</p></div><strong className={`rounded-full px-3 py-1.5 text-sm ${surplus >= 0 ? "bg-emerald-400/10 text-emerald-200" : "bg-red-400/10 text-red-200"}`}>Sobra: {money.format(surplus)}</strong></div><div className="mt-3 grid grid-cols-3 gap-2 text-center"><MiniValue label="Entradas" value={money.format(income)} color="text-emerald-300" /><MiniValue label="Saídas" value={money.format(expense)} color="text-red-300" /><MiniValue label="Saldo" value={money.format(surplus)} color={surplus >= 0 ? "text-cyan-200" : "text-red-300"} /></div></article>;
      })}</div> : <p className="p-7 text-center text-sm text-white/40">Nenhum racha encontrado neste mês.</p>}
    </section>

    <section className="mt-6 rounded-2xl border border-emerald-300/15 bg-emerald-400/[0.045] p-4 sm:p-5">
      <div className="flex items-center gap-2"><WalletCards className="h-5 w-5 text-emerald-200" /><div><h2 className="font-black text-white">Adicionar saldo a uma pessoa</h2><p className="text-xs text-white/45">O saldo fica em reais e pode pagar um racha futuro inteiro.</p></div></div>
      <PlayerBalanceForm action={addPlayerBalance} players={selectableProfiles.map((profile) => ({ id: profile.id, fullName: profile.full_name }))} />
    </section>

    <section className="mt-7">
      <div className="flex items-end justify-between gap-3"><div><h2 className="font-black text-white">Saldos disponíveis</h2><p className="mt-1 text-xs text-white/45">{holders.length} pessoas · total reservado de {money.format(totalPlayerBalance)}</p></div><span className="rounded-full bg-emerald-400/10 px-3 py-1.5 text-xs font-black text-emerald-200">{money.format(totalPlayerBalance)}</span></div>
      {holders.length ? <div className="mt-3 grid gap-3 lg:grid-cols-2">{holders.map(([profileId, currentBalance]) => {
        const player = profileById.get(profileId); const entries = entriesByProfile.get(profileId) ?? [];
        return <article key={profileId} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
          <div className="flex items-center gap-3 border-b border-white/[0.07] p-4"><Avatar src={player?.avatar_url ?? null} name={player?.full_name ?? "Jogador"} size="md" /><div className="min-w-0 flex-1"><p className="truncate font-black text-white">{player?.full_name ?? "Perfil não encontrado"}</p><p className="mt-0.5 text-sm font-black text-emerald-200">{money.format(currentBalance)} disponíveis</p></div></div>
          <div className="p-4"><ActionForm action={applyPlayerBalance} successMessage="Saldo utilizado e pagamento confirmado!" className="flex min-w-0 gap-2"><input type="hidden" name="profileId" value={profileId} /><select name="eventId" required defaultValue="" className="field min-w-0 flex-1 text-xs"><option value="" disabled>Usar no racha...</option>{events.map((event) => <option key={event.id} value={event.id}>{eventLabel(event)}</option>)}</select><button type="submit" className="min-h-11 shrink-0 rounded-xl bg-emerald-500/15 px-3 text-xs font-black text-emerald-200 hover:bg-emerald-500/25">Usar saldo</button></ActionForm></div>
          <details className="border-t border-white/[0.07]"><summary className="cursor-pointer px-4 py-3 text-xs font-semibold text-white/45">Ver movimentações ({entries.length})</summary><div className="divide-y divide-white/[0.06]">{entries.slice(0, 8).map((entry) => <div key={entry.id} className="flex items-start gap-3 px-4 py-3"><span className={`mt-0.5 font-black ${entry.entry_type === "credit" ? "text-emerald-300" : "text-amber-300"}`}>{entry.entry_type === "credit" ? "+" : "−"}{money.format(amount(entry.amount))}</span><div className="min-w-0 flex-1"><p className="text-xs font-semibold text-white/75">{entry.description}</p><p className="mt-0.5 text-[10px] text-white/35">{formatDate(entry.created_at)}{entry.event_id && eventById.get(entry.event_id) ? ` · ${eventLabel(eventById.get(entry.event_id)!)}` : ""}</p></div>{entry.entry_type === "credit" && <ActionForm action={reversePlayerBalance} successMessage="Lançamento estornado."><input type="hidden" name="entryId" value={entry.id} /><button type="submit" title="Estornar saldo" className="grid h-8 w-8 place-items-center rounded-full text-white/35 hover:bg-red-400/10 hover:text-red-300"><RotateCcw className="h-3.5 w-3.5" /></button></ActionForm>}</div>)}</div></details>
        </article>;
      })}</div> : <Empty text="Nenhuma pessoa possui saldo disponível." />}
    </section>

    <section className="mt-7 grid gap-4 xl:grid-cols-[1.15fr_.85fr]">
      <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:p-5"><div className="flex items-center gap-2"><CircleDollarSign className="h-5 w-5 text-purple-300" /><div><h2 className="font-black text-white">Nova movimentação manual</h2><p className="text-xs text-white/40">Patrocínio, aluguel, medalhas ou outra entrada e saída.</p></div></div><ActionForm action={addFinanceTransaction} successMessage="Movimentação registrada!" resetOnSuccess className="mt-4 grid gap-3 sm:grid-cols-2">
        <label><Label>Tipo</Label><select name="transactionType" className="field"><option value="income">Entrada</option><option value="expense">Saída</option></select></label>
        <label><Label>Categoria</Label><select name="category" className="field"><option value="sponsorship">Patrocínio</option><option value="court_rental">Aluguel da quadra</option><option value="medals">Medalhas</option><option value="other">Outro</option></select></label>
        <label><Label>Valor</Label><input name="amount" inputMode="decimal" required placeholder="0,00" className="field" /></label><label><Label>Data</Label><input type="date" name="transactionDate" defaultValue={today} required className="field" /></label>
        <label className="sm:col-span-2"><Label>Vincular a um racha</Label><select name="eventId" defaultValue="" className="field"><option value="">Caixa geral · sem racha específico</option>{events.map((event) => <option key={event.id} value={event.id}>{eventLabel(event)}</option>)}</select><span className="mt-1 block text-[10px] text-white/35">Vincule aluguel, medalha ou outra despesa para calcular a sobra daquele racha.</span></label>
        <label className="sm:col-span-2"><Label>Descrição</Label><input name="description" maxLength={160} required placeholder="Ex.: pagamento do aluguel da NR" className="field" /></label><label className="sm:col-span-2"><Label>Observação opcional</Label><input name="notes" maxLength={500} className="field" /></label><button type="submit" className="min-h-11 rounded-xl bg-purple-500 px-4 text-sm font-black text-white sm:col-span-2 hover:bg-purple-400">Registrar movimentação</button>
      </ActionForm></div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:p-5"><div className="flex items-center gap-2"><CalendarClock className="h-5 w-5 text-amber-200" /><div><h2 className="font-black text-white">Agenda financeira</h2><p className="text-xs text-white/40">Contas e tarefas que não podem ser esquecidas.</p></div></div><ActionForm action={addFinanceReminder} successMessage="Lembrete criado!" resetOnSuccess className="mt-4 grid grid-cols-[1fr_auto] gap-2"><input name="title" required maxLength={140} placeholder="Ex.: pagar medalhas" className="field min-w-0" /><input type="date" name="dueDate" className="field w-[8.7rem]" /><input name="notes" maxLength={500} placeholder="Observação opcional" className="field col-span-2" /><button type="submit" className="col-span-2 min-h-10 rounded-xl bg-amber-300/15 text-xs font-black text-amber-100 hover:bg-amber-300/25">Adicionar à agenda</button></ActionForm>
        <div className="mt-4 space-y-2">{reminders.length ? reminders.map((reminder) => <div key={reminder.id} className={`flex items-start gap-3 rounded-xl border p-3 ${reminder.completed ? "border-white/5 bg-white/[0.015] opacity-55" : "border-white/10 bg-black/10"}`}><ActionForm action={toggleFinanceReminder} successMessage={reminder.completed ? "Lembrete reaberto." : "Lembrete concluído!"}><input type="hidden" name="reminderId" value={reminder.id} /><input type="hidden" name="completed" value={reminder.completed ? "false" : "true"} /><button type="submit" className={`grid h-8 w-8 place-items-center rounded-full border ${reminder.completed ? "border-emerald-300/30 bg-emerald-400/15 text-emerald-200" : "border-white/15 text-white/30 hover:text-emerald-200"}`}>{reminder.completed ? <Check className="h-4 w-4" /> : <ClipboardCheck className="h-4 w-4" />}</button></ActionForm><div className="min-w-0"><p className={`text-sm font-semibold text-white ${reminder.completed ? "line-through" : ""}`}>{reminder.title}</p>{reminder.due_date && <p className="mt-0.5 text-[10px] font-bold text-amber-200/70">Prazo: {formatDate(reminder.due_date)}</p>}{reminder.notes && <p className="mt-1 text-xs leading-5 text-white/40">{reminder.notes}</p>}</div></div>) : <p className="py-4 text-center text-xs text-white/30">Agenda vazia.</p>}</div>
      </div>
    </section>

    <section className="mt-7 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]"><div className="flex items-center justify-between gap-3 border-b border-white/10 p-4"><div className="flex items-center gap-2"><History className="h-5 w-5 text-purple-300" /><div><h2 className="font-black capitalize text-white">Extrato de {formatMonth(selectedMonth)}</h2><p className="text-xs text-white/40">As camisas ficam fora deste caixa e aparecem somente na área de pedidos.</p></div></div><span className="text-xs font-black text-white/35">{displayTransactions.filter((row) => !row.voided_at).length}</span></div>
      {displayTransactions.length ? <div className="divide-y divide-white/[0.07]">{displayTransactions.slice(0, 80).map((row) => { const player = row.profile_id ? profileById.get(row.profile_id) : null; return <article key={row.id} className={`flex items-center gap-3 p-3 sm:p-4 ${row.voided_at ? "opacity-40" : ""}`}><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${row.transaction_type === "income" ? "bg-emerald-400/10 text-emerald-300" : "bg-red-400/10 text-red-300"}`}>{row.transaction_type === "income" ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-bold text-white">{row.description}</p>{row.voided_at && <span className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-black text-white/50">ESTORNADO</span>}</div><p className="mt-0.5 truncate text-[10px] text-white/35">{categoryLabels[row.category] ?? row.category}{player ? ` · ${player.full_name}` : ""} · {formatDate(row.transaction_date)}</p></div><strong className={row.transaction_type === "income" ? "text-emerald-300" : "text-red-300"}>{row.transaction_type === "income" ? "+" : "−"}{money.format(amount(row.amount))}</strong>{!row.voided_at && !row.payment_id && !row.balance_entry_id && <ActionForm action={voidFinanceTransaction} successMessage="Movimentação estornada."><input type="hidden" name="transactionId" value={row.id} /><button type="submit" title="Estornar movimentação" className="grid h-8 w-8 place-items-center rounded-full text-white/30 hover:bg-red-400/10 hover:text-red-300"><X className="h-3.5 w-3.5" /></button></ActionForm>}</article>; })}</div> : <p className="p-8 text-center text-sm text-white/35">O extrato aparecerá conforme o caixa for movimentado.</p>}
    </section>
  </div>;
}

function Stat({ icon: Icon, label, value, color }: { icon: typeof WalletCards; label: string; value: string; color: string }) { return <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4"><Icon className={`h-5 w-5 ${color}`} /><AnimatedMetric className="mt-2 block truncate text-base font-bold text-white sm:text-xl" value={value} /><span className="mt-1 block text-[9px] font-semibold uppercase leading-tight tracking-wide text-white/40 sm:text-[10px]">{label}</span></div>; }
function MiniValue({ label, value, color }: { label: string; value: string; color: string }) { return <div className="rounded-xl bg-black/10 p-2"><p className="text-[9px] font-black uppercase tracking-wide text-white/35">{label}</p><p className={`mt-1 truncate text-sm font-black ${color}`}>{value}</p></div>; }
function Label({ children }: { children: React.ReactNode }) { return <span className="mb-1.5 block text-xs font-semibold text-white/55">{children}</span>; }
function Empty({ text }: { text: string }) { return <div className="mt-3 rounded-2xl border border-dashed border-white/10 p-8 text-center"><WalletCards className="mx-auto h-8 w-8 text-white/20" /><p className="mt-3 font-semibold text-white/50">{text}</p></div>; }
