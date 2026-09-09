import { createClient } from "@/lib/supabase/server";
import { requireOrganizer } from "@/lib/auth";
import { approveProfile, rejectProfile } from "./actions";

export default async function SolicitacoesPage() {
  await requireOrganizer();
  const supabase = await createClient();

  const { data: pending } = await supabase
    .from("profiles")
    .select("id, full_name, birthdate, phone, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  return (
    <div>
      <h1 className="text-2xl font-bold text-brand-navy">Solicitações de entrada</h1>
      <p className="mt-1 text-sm text-gray-500">
        Aprove quem realmente faz parte do grupo antes de liberar o acesso.
      </p>

      <div className="mt-6 space-y-3">
        {!pending?.length && (
          <p className="text-sm text-gray-500">Nenhuma solicitação pendente. 🎉</p>
        )}
        {pending?.map((p) => (
          <div
            key={p.id}
            className="flex flex-col gap-3 rounded-lg border border-gray-200 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="font-medium text-brand-navy">{p.full_name}</p>
              <p className="text-xs text-gray-500">
                Nascimento: {p.birthdate ?? "—"} · Tel: {p.phone ?? "—"}
              </p>
            </div>
            <div className="flex gap-2">
              <form action={approveProfile}>
                <input type="hidden" name="profileId" value={p.id} />
                <button className="rounded-lg bg-brand-purple px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-purple-dark">
                  Aprovar
                </button>
              </form>
              <form action={rejectProfile}>
                <input type="hidden" name="profileId" value={p.id} />
                <button className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
                  Rejeitar
                </button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
