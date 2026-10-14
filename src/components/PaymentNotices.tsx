import Link from "next/link";
import { CircleDollarSign } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { Community } from "@/lib/community";

type Props = { profileId: string; community: Community };

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function formatDay(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
}

/**
 * Avisos de pagamento na tela da pessoa. Somem sozinhos assim que o pagamento
 * é registrado (Pix, saldo ou marcação manual) ou o saldo é usado.
 */
export async function PaymentNotices({ profileId, community }: Props) {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: rows } = await supabase
    .from("attendance")
    .select("event_id, events!inner(id, date, status, price_per_player, community)")
    .eq("profile_id", profileId)
    .eq("status", "confirmed")
    .eq("events.community", community)
    .gte("events.date", today)
    .not("events.price_per_player", "is", null);

  const events = (rows ?? [])
    .map((row) => row.events as unknown as { id: string; date: string; status: string; price_per_player: string | number } | null)
    .filter((event): event is NonNullable<typeof event> => Boolean(event) && event!.status !== "cancelled" && event!.status !== "finished" && Number(event!.price_per_player) > 0);

  let pending: typeof events = [];
  if (events.length) {
    const { data: paid } = await supabase
      .from("payments")
      .select("event_id")
      .eq("profile_id", profileId)
      .eq("paid", true)
      .in("event_id", events.map((event) => event.id));
    const paidIds = new Set((paid ?? []).map((row) => row.event_id));
    pending = events.filter((event) => !paidIds.has(event.id)).sort((a, b) => a.date.localeCompare(b.date));
  }

  if (!pending.length) return null;

  return (
    <div className="mb-4 space-y-2">
      {pending.map((event) => (
        <Link
          key={event.id}
          href={`/racha/${event.id}/confirmar`}
          className="flex items-center gap-3 rounded-2xl border border-emerald-300/25 bg-emerald-400/10 px-4 py-3 transition hover:bg-emerald-400/15"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-400/20 text-emerald-200">
            <CircleDollarSign className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-black text-white">Falta pagar seu racha de {formatDay(event.date)}</span>
            <span className="block text-xs text-emerald-100/70">Sua vaga está confirmada. Toque para pagar {money.format(Number(event.price_per_player))} por Pix.</span>
          </span>
          <span className="shrink-0 rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-black text-white">Pagar</span>
        </Link>
      ))}
    </div>
  );
}
