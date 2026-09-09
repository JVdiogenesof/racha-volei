import { notFound } from "next/navigation";
import { Wallet, CheckCircle2, Circle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireOrganizer } from "@/lib/auth";
import { ActionForm } from "@/components/ActionForm";
import { setPaymentStatus } from "./actions";

export default async function PagamentosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireOrganizer();
  const supabase = await createClient();

  const { data: event } = await supabase
    .from("events")
    .select("id, date, price_per_player")
    .eq("id", id)
    .maybeSingle();
  if (!event) notFound();

  const { data: confirmed } = await supabase
    .from("attendance")
    .select("profile_id, profiles(full_name)")
    .eq("event_id", id)
    .eq("status", "confirmed");

  const { data: paymentRows } = await supabase
    .from("payments")
    .select("profile_id, paid")
    .eq("event_id", id);

  const paidByProfile = new Map((paymentRows ?? []).map((p) => [p.profile_id, p.paid]));
  const price = Number(event.price_per_player ?? 0);
  const totalEsperado = price * (confirmed?.length ?? 0);
  const totalArrecadado = (confirmed ?? []).filter((c) => paidByProfile.get(c.profile_id)).length * price;
  const pct = totalEsperado > 0 ? Math.round((totalArrecadado / totalEsperado) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-brand-navy">
          <Wallet className="h-6 w-6 text-brand-purple" strokeWidth={2} />
          Pagamentos · {new Date(`${event.date}T00:00:00`).toLocaleDateString("pt-BR")}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          R$ {totalArrecadado.toFixed(2)} arrecadado de R$ {totalEsperado.toFixed(2)} esperado
          {price ? ` (R$ ${price.toFixed(2)} por jogador)` : ""}
        </p>
        {totalEsperado > 0 && (
          <div className="mt-2 h-2 w-full max-w-sm rounded-full bg-gray-100">
            <div className="h-2 rounded-full bg-green-500" style={{ width: `${pct}%` }} />
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400">Clique no nome ou no círculo pra marcar/desmarcar o pagamento.</p>

      <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200">
        {confirmed?.map((c) => {
          const name = (c.profiles as unknown as { full_name: string } | null)?.full_name ?? "—";
          const paid = paidByProfile.get(c.profile_id) ?? false;
          return (
            <li key={c.profile_id}>
              <ActionForm
                action={setPaymentStatus}
                successMessage={paid ? "Pagamento desmarcado." : "Pagamento confirmado!"}
              >
                <input type="hidden" name="eventId" value={id} />
                <input type="hidden" name="profileId" value={c.profile_id} />
                <input type="hidden" name="paid" value={(!paid).toString()} />
                <button
                  type="submit"
                  className={`flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-gray-50 ${
                    paid ? "bg-green-50/40" : ""
                  }`}
                >
                  <span className="text-sm text-brand-navy">{name}</span>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
                      paid
                        ? "border-green-200 bg-green-100 text-green-700"
                        : "border-gray-300 bg-white text-gray-500"
                    }`}
                  >
                    {paid ? (
                      <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} />
                    ) : (
                      <Circle className="h-3.5 w-3.5" strokeWidth={2} />
                    )}
                    {paid ? "Pago" : "Marcar como pago"}
                  </span>
                </button>
              </ActionForm>
            </li>
          );
        })}
        {!confirmed?.length && (
          <li className="px-4 py-3 text-sm text-gray-500">Ninguém confirmado presença ainda.</li>
        )}
      </ul>
    </div>
  );
}
