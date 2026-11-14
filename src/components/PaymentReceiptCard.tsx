import { BadgeCheck, CalendarDays, MapPin, Receipt } from "lucide-react";
import { SaveReceiptImageButton } from "./SaveReceiptImageButton";
import { SOURCE_LABEL, dateTime, eventDayLabel, money } from "@/lib/receiptFormat";

/**
 * "Minha vaga": comprovante de quem está confirmado, pra tirar a dúvida
 * "será que eu entrei?" sem precisar perguntar pra organização.
 */
export function PaymentReceiptCard({
  playerName,
  eventDate,
  eventTime,
  location,
  position,
  total,
  confirmedAt,
  payment,
  orderId,
  eventId,
}: {
  eventId: string;
  playerName: string;
  eventDate: string;
  eventTime: string | null;
  location: string | null;
  position: number | null;
  total: number;
  confirmedAt: string | null;
  payment: { paid: boolean; payment_source: string | null; paid_at: string | null; amount: number | null } | null;
  orderId: string | null;
}) {
  const day = eventDayLabel(eventDate);
  const paid = Boolean(payment?.paid);
  const source = payment?.payment_source ? SOURCE_LABEL[payment.payment_source] ?? payment.payment_source : null;

  const rows: [string, string][] = [
    ["Jogador(a)", playerName],
    ["Posição na lista", position ? `${position}º de ${total}` : "—"],
    ["Confirmado em", dateTime(confirmedAt)],
  ];
  if (paid) {
    rows.push(["Forma", source ?? "—"]);
    if (payment?.payment_source !== "exempt") rows.push(["Valor", money(payment?.amount)]);
    rows.push(["Pago em", dateTime(payment?.paid_at)]);
    if (orderId) rows.push(["Código", orderId]);
  } else {
    rows.push(["Pagamento", "Pendente"]);
  }

  return (
    <section
      id="minha-vaga"
      className="scroll-mt-24 overflow-hidden rounded-2xl border border-emerald-300/25 bg-gradient-to-br from-emerald-400/10 via-white/[0.04] to-purple-500/10"
    >
      <div className="flex items-center justify-between gap-3 border-b border-dashed border-white/15 px-4 py-3">
        <div className="flex items-center gap-2">
          <Receipt className="h-4 w-4 text-emerald-200" aria-hidden />
          <h2 className="text-sm font-bold uppercase tracking-wide text-white">Minha vaga</h2>
        </div>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${
            paid ? "bg-emerald-400/20 text-emerald-100" : "bg-amber-400/20 text-amber-100"
          }`}
        >
          <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
          {paid ? "Vaga garantida" : "Falta pagar"}
        </span>
      </div>

      <div className="space-y-1.5 px-4 pt-3 text-xs text-white/70">
        <p className="flex items-center gap-2 capitalize">
          <CalendarDays className="h-3.5 w-3.5 text-white/50" aria-hidden />
          {day}
          {eventTime ? ` · ${eventTime.slice(0, 5)}` : ""}
        </p>
        {location && (
          <p className="flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5 text-white/50" aria-hidden />
            {location}
          </p>
        )}
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 px-4 py-3 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-white/50">{label}</dt>
            <dd className="break-all text-right font-semibold text-white">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 px-4 py-2.5">
        <p className="text-[11px] text-white/45">Você aparece na aba &quot;Confirmados&quot; da lista.</p>
        <SaveReceiptImageButton eventId={eventId} />
      </div>
    </section>
  );
}
