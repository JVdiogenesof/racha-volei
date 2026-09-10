import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";

export default async function HistoricoPage() {
  await requireProfile();
  const supabase = await createClient();

  const { data: events } = await supabase
    .from("events")
    .select("id, date, location, price_per_player, mvp_profile_id, profiles!events_mvp_profile_id_profiles_id_fk(full_name)")
    .eq("status", "finished")
    .order("date", { ascending: false });

  const rows = await Promise.all(
    (events ?? []).map(async (event) => {
      const { count: confirmedCount } = await supabase
        .from("attendance")
        .select("id", { count: "exact", head: true })
        .eq("event_id", event.id)
        .eq("status", "confirmed");

      const mvp = (event.profiles as unknown as { full_name: string } | null)?.full_name ?? null;

      return {
        ...event,
        confirmedCount: confirmedCount ?? 0,
        mvp,
      };
    }),
  );

  return (
    <div>
      <h1 className="text-2xl font-bold text-brand-navy">Histórico</h1>

      <div className="mt-6 space-y-3">
        {!rows.length && <p className="text-sm text-gray-500">Ainda não teve racha finalizado.</p>}
        {rows.map((e) => (
          <Link
            key={e.id}
            href={`/racha/${e.id}`}
            className="block rounded-lg border border-gray-200 px-4 py-3 hover:bg-gray-50"
          >
            <div className="flex items-center justify-between">
              <span className="font-medium text-brand-navy">
                {new Date(`${e.date}T00:00:00`).toLocaleDateString("pt-BR")}
                {e.location ? ` · ${e.location}` : ""}
              </span>
              <span className="text-xs text-gray-400">{e.confirmedCount} jogadores</span>
            </div>
            <div className="mt-1 flex gap-4 text-xs text-gray-500">
              <span>MVP: {e.mvp ?? "não escolhido"}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
