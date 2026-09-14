import { BarChart3, CalendarDays, Users2, Trophy, UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireOrganizer } from "@/lib/auth";

function monthRange(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export default async function AdminResumoPage() {
  await requireOrganizer();
  const supabase = await createClient();

  const now = new Date();
  const { start, end } = monthRange(now);
  const monthLabel = now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  const [{ data: events }, { count: newMembersCount }] = await Promise.all([
    supabase
      .from("events")
      .select("id, date, mvp_profile_id, mvp_profile_id_2")
      .gte("date", start)
      .lte("date", end)
      .order("date", { ascending: true }),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("status", "approved")
      .gte("created_at", `${start}T00:00:00`)
      .lte("created_at", `${end}T23:59:59`),
  ]);

  const eventIds = (events ?? []).map((e) => e.id);

  const { data: attendanceRows } = eventIds.length
    ? await supabase.from("attendance").select("event_id, profile_id").eq("status", "confirmed").in("event_id", eventIds)
    : { data: [] };

  const confirmedByEvent = new Map<string, number>();
  const attendanceByProfile = new Map<string, number>();
  for (const a of attendanceRows ?? []) {
    confirmedByEvent.set(a.event_id, (confirmedByEvent.get(a.event_id) ?? 0) + 1);
    attendanceByProfile.set(a.profile_id, (attendanceByProfile.get(a.profile_id) ?? 0) + 1);
  }

  const destaqueByProfile = new Map<string, number>();
  for (const e of events ?? []) {
    for (const profileId of [e.mvp_profile_id, e.mvp_profile_id_2]) {
      if (!profileId) continue;
      destaqueByProfile.set(profileId, (destaqueByProfile.get(profileId) ?? 0) + 1);
    }
  }

  const totalConfirmados = [...confirmedByEvent.values()].reduce((sum, n) => sum + n, 0);
  const mediaConfirmados = eventIds.length ? totalConfirmados / eventIds.length : 0;

  const topAttendeeId = [...attendanceByProfile.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const topDestaqueId = [...destaqueByProfile.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const profileIdsToName = [topAttendeeId, topDestaqueId].filter((id): id is string => !!id);
  const { data: profiles } = profileIdsToName.length
    ? await supabase.from("profiles").select("id, full_name").in("id", profileIdsToName)
    : { data: [] };
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  const stats = [
    { label: "Rachas no mês", value: eventIds.length, icon: CalendarDays },
    { label: "Média de confirmados", value: mediaConfirmados.toFixed(1), icon: Users2 },
    { label: "Novos membros", value: newMembersCount ?? 0, icon: UserPlus },
  ];

  return (
    <div>
      <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
        <BarChart3 className="h-6 w-6 text-purple-300" strokeWidth={2} />
        Resumo mensal
      </h1>
      <p className="mt-1 text-sm capitalize text-white/60">{monthLabel}</p>

      <div className="mt-6 grid grid-cols-3 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
            <s.icon className="mx-auto h-5 w-5 text-purple-300" strokeWidth={2} />
            <p className="mt-2 text-xl font-bold text-white">{s.value}</p>
            <p className="text-xs text-white/60">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 space-y-3">
        <div className="flex items-center justify-between rounded-lg border border-white/10 px-4 py-3">
          <span className="flex items-center gap-2 text-sm text-white/70">
            <Users2 className="h-4 w-4 text-purple-300" strokeWidth={2} />
            Quem mais compareceu
          </span>
          <span className="text-sm font-medium text-white">
            {topAttendeeId ? `${nameById.get(topAttendeeId)} (${attendanceByProfile.get(topAttendeeId)})` : "—"}
          </span>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-white/10 px-4 py-3">
          <span className="flex items-center gap-2 text-sm text-white/70">
            <Trophy className="h-4 w-4 text-purple-300" strokeWidth={2} />
            Mais vezes Jogador Destaque
          </span>
          <span className="text-sm font-medium text-white">
            {topDestaqueId ? `${nameById.get(topDestaqueId)} (${destaqueByProfile.get(topDestaqueId)})` : "—"}
          </span>
        </div>
      </div>

      {!eventIds.length && (
        <p className="mt-6 text-sm text-white/60">Nenhum racha marcado nesse mês ainda.</p>
      )}
    </div>
  );
}
