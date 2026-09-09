import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";

export default async function HistoricoPage() {
  await requireProfile();
  const supabase = await createClient();

  const today = new Date().toISOString().slice(0, 10);
  const { data: events } = await supabase
    .from("events")
    .select("id, date, location, price_per_player")
    .lt("date", today)
    .order("date", { ascending: false });

  const rows = await Promise.all(
    (events ?? []).map(async (event) => {
      const [{ count: confirmedCount }, { data: votes }, { data: payments }] = await Promise.all([
        supabase
          .from("attendance")
          .select("id", { count: "exact", head: true })
          .eq("event_id", event.id)
          .eq("status", "confirmed"),
        supabase
          .from("mvp_votes")
          .select("voted_for_profile_id, profiles!mvp_votes_voted_for_profile_id_fkey(full_name)")
          .eq("event_id", event.id),
        supabase.from("payments").select("paid").eq("event_id", event.id),
      ]);

      const tally = new Map<string, { count: number; name: string }>();
      for (const v of votes ?? []) {
        const name = (v.profiles as unknown as { full_name: string } | null)?.full_name ?? "—";
        const current = tally.get(v.voted_for_profile_id) ?? { count: 0, name };
        current.count += 1;
        tally.set(v.voted_for_profile_id, current);
      }
      const mvp = [...tally.values()].sort((a, b) => b.count - a.count)[0]?.name ?? null;
      const paidCount = (payments ?? []).filter((p) => p.paid).length;

      return {
        ...event,
        confirmedCount: confirmedCount ?? 0,
        mvp,
        paidCount,
        totalPayments: payments?.length ?? 0,
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
              <span>MVP: {e.mvp ?? "sem votos"}</span>
              <span>
                Pagamentos: {e.paidCount}/{e.totalPayments}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
