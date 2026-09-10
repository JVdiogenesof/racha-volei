import { Phone, CheckCircle2, Circle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireOrganizer } from "@/lib/auth";
import { ActionForm } from "@/components/ActionForm";
import { DeleteReserveEntryButton } from "@/components/DeleteReserveEntryButton";
import { toggleContacted, removeFromReserveList } from "./actions";

export default async function AdminReservaPage() {
  await requireOrganizer();
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("reserve_list")
    .select("id, full_name, phone, contacted, created_at")
    .order("created_at", { ascending: true });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-navy">Lista de reserva</h1>
        <p className="mt-1 text-sm text-gray-500">
          Pessoas de fora do grupo que topam ser chamadas quando sobrar vaga de última hora num
          racha.
        </p>
      </div>

      <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200">
        {rows?.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="font-medium text-brand-navy">{r.full_name}</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-sm text-gray-500">
                <Phone className="h-3.5 w-3.5" strokeWidth={2} />
                {r.phone}
              </p>
            </div>
            <div className="flex items-center gap-2">
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
                      ? "border-green-200 bg-green-100 text-green-700"
                      : "border-gray-300 bg-white text-gray-500 hover:bg-gray-50"
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
        ))}
        {!rows?.length && (
          <li className="px-4 py-4 text-sm text-gray-500">Ninguém na lista de reserva ainda.</li>
        )}
      </ul>
    </div>
  );
}
