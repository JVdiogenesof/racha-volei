import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";

export default async function HistoricoPage() {
  await requireProfile();
  const supabase = await createClient();

  const { data: events } = await supabase
    .from("events")
    .select(
      "id, date, location, price_per_player, mvp_profile_id, mvp_profile_id_2, mvp1:profiles!events_mvp_profile_id_profiles_id_fk(full_name), mvp2:profiles!events_mvp_profile_id_2_profiles_id_fk(full_name)",
    )
    .eq("status", "finished")
    .order("date", { ascending: false });

  const rows = await Promise.all(
    (events ?? []).map(async (event) => {
      const { count: confirmedCount } = await supabase
        .from("attendance")
        .select("id", { count: "exact", head: true })
        .eq("event_id", event.id)
        .eq("status", "confirmed");

      const mvp1 = (event.mvp1 as unknown as { full_name: string } | null)?.full_name ?? null;
      const mvp2 = (event.mvp2 as unknown as { full_name: string } | null)?.full_name ?? null;
      const destaques = [mvp1, mvp2].filter((n): n is string => !!n);

      return {
        ...event,
        confirmedCount: confirmedCount ?? 0,
        destaques,
      };
    }),
  );

  return (
    <div>
      <h1 className="text-2xl font-bold text-white">Histórico</h1>

      <div className="mt-6 space-y-3">
        {!rows.length && <p className="text-sm text-white/60">Ainda não teve racha finalizado.</p>}
        {rows.map((e) => (
          <Link
            key={e.id}
            href={`/racha/${e.id}`}
            className="block rounded-lg border border-white/10 px-4 py-3 hover:bg-white/5"
          >
            <div className="flex items-center justify-between">
              <span className="font-medium text-white">
                {new Date(`${e.date}T00:00:00`).toLocaleDateString("pt-BR")}
                {e.location ? ` · ${e.location}` : ""}
              </span>
              <span className="text-xs text-white/40">{e.confirmedCount} jogadores</span>
            </div>
            <div className="mt-1 flex gap-4 text-xs text-white/60">
              <span>
                {e.destaques.length ? `Destaque${e.destaques.length > 1 ? "s" : ""}: ${e.destaques.join(", ")}` : "Destaque: não escolhido"}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
