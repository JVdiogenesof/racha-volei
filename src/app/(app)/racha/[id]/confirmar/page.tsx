import { notFound } from "next/navigation";
import { Check, X } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { Avatar } from "@/components/Avatar";
import { ActionForm } from "@/components/ActionForm";
import { setAttendance } from "./actions";

export default async function ConfirmarPresencaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: event } = await supabase
    .from("events")
    .select("id, date, status")
    .eq("id", id)
    .maybeSingle();

  if (!event) notFound();

  const eventFinished = event.status === "finished";

  const { data: attendanceList } = await supabase
    .from("attendance")
    .select("status, profiles(full_name, avatar_url)")
    .eq("event_id", id)
    .order("confirmed_at", { ascending: true });

  const { data: myAttendance } = await supabase
    .from("attendance")
    .select("status")
    .eq("event_id", id)
    .eq("profile_id", profile.id)
    .maybeSingle();

  const confirmados = attendanceList?.filter((a) => a.status === "confirmed") ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-navy">
          Confirmar presença · {new Date(`${event.date}T00:00:00`).toLocaleDateString("pt-BR")}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Situação atual:{" "}
          <strong>{myAttendance?.status === "confirmed" ? "Confirmado" : myAttendance?.status === "declined" ? "Não vai" : "Ainda não respondeu"}</strong>
        </p>
      </div>

      {eventFinished ? (
        <p className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-4 text-sm text-gray-500">
          Esse racha já terminou — não dá mais pra confirmar ou desmarcar presença.
        </p>
      ) : (
        <div className="flex gap-3">
          <ActionForm action={setAttendance} successMessage="Presença confirmada!">
            <input type="hidden" name="eventId" value={id} />
            <input type="hidden" name="status" value="confirmed" />
            <button className="inline-flex items-center gap-1.5 rounded-lg bg-brand-purple px-4 py-2 font-medium text-white hover:bg-brand-purple-dark">
              <Check className="h-4 w-4" strokeWidth={2} />
              Vou jogar
            </button>
          </ActionForm>
          <ActionForm action={setAttendance} successMessage="Você marcou que não vai.">
            <input type="hidden" name="eventId" value={id} />
            <input type="hidden" name="status" value="declined" />
            <button className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-600 hover:bg-gray-50">
              <X className="h-4 w-4" strokeWidth={2} />
              Não vou
            </button>
          </ActionForm>
        </div>
      )}

      <section>
        <h2 className="font-semibold text-brand-navy">Confirmados ({confirmados.length})</h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {confirmados.map((a, i) => {
            const p = a.profiles as unknown as { full_name: string; avatar_url: string | null } | null;
            return (
              <li
                key={i}
                className="flex items-center gap-3 rounded-lg border border-gray-200 px-3 py-2.5"
              >
                <Avatar src={p?.avatar_url} name={p?.full_name ?? "?"} size="sm" />
                <span className="truncate text-sm text-brand-navy">{p?.full_name}</span>
              </li>
            );
          })}
          {!confirmados.length && (
            <li className="text-sm text-gray-500">Ninguém confirmou ainda.</li>
          )}
        </ul>
      </section>
    </div>
  );
}
