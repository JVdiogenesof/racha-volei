import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Radio } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireOrganizer } from "@/lib/auth";
import { getActiveCommunity } from "@/lib/community";
import { getRankingCounts } from "@/lib/rankings";
import { getSeasonRanking, INDEX_MIN_EVENTS, ROLLING_INDEX_EVENT_COUNT } from "@/lib/seasonRanking";
import { getProfileRankingSheet } from "@/lib/rankingAdjust";
import { Avatar } from "@/components/Avatar";
import { RankingAdjustControl } from "@/components/RankingAdjustControl";
import { RankingSheetEvent } from "@/components/RankingSheetEvent";
import { DeleteRankingAdjustmentButton } from "@/components/DeleteRankingAdjustmentButton";
import { adjustEventResult, adjustRanking, deleteRankingAdjustment, setEventFlag } from "../actions";

const METRIC_LABELS: Record<string, string> = { attendance: "presença", mvp: "destaque", wins: "vitória", losses: "derrota" };

function formatDay(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function Tile({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] px-2 py-2.5 text-center">
      <b className="block text-xl font-extrabold tabular-nums leading-tight text-white">{value}</b>
      <span className="text-[9.5px] font-bold uppercase tracking-[0.07em] text-white/40">{label}</span>
    </div>
  );
}

export default async function AdminRankingPlayerPage({ params }: { params: Promise<{ profileId: string }> }) {
  const { profileId } = await params;
  const organizer = await requireOrganizer();
  const supabase = await createClient();
  const community = await getActiveCommunity(organizer);

  const { data: profile } = await supabase.from("profiles").select("id, full_name, avatar_url").eq("id", profileId).maybeSingle();
  if (!profile) notFound();

  const [seasonScores, counts, sheet, { data: adjustments }] = await Promise.all([
    getSeasonRanking(supabase, community),
    getRankingCounts(supabase, community),
    getProfileRankingSheet(supabase, community, profileId),
    supabase
      .from("ranking_adjustments")
      .select("id, metric, delta, reason, events(date)")
      .eq("community", community)
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  const score = seasonScores.get(profileId);
  const position = [...seasonScores.values()]
    .filter((item) => item.eligible)
    .sort((a, b) => b.averageIndex - a.averageIndex || b.totalWins - a.totalWins || b.totalAttendance - a.totalAttendance)
    .findIndex((item) => item.profileId === profileId);
  const wins = score?.totalWins ?? 0;
  const losses = score?.totalLosses ?? 0;
  const percentage = wins + losses ? Math.round((wins / (wins + losses)) * 100) : 0;
  const extraByMetric = { attendance: 0, mvp: 0, wins: 0 };
  for (const row of adjustments ?? []) {
    const hasEvent = Boolean(row.events);
    if (!hasEvent && row.metric in extraByMetric) extraByMetric[row.metric as keyof typeof extraByMetric] += row.delta;
  }

  return (
    <div className="space-y-4">
      <Link href="/admin/ranking" className="inline-flex min-h-9 items-center gap-1 text-sm font-bold text-violet-200 hover:text-white">
        <ChevronLeft className="h-4 w-4" /> Jogadores
      </Link>

      <header className="flex items-center gap-3">
        <Avatar src={profile.avatar_url} name={profile.full_name} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-black text-white">{profile.full_name}</h1>
          <p className="text-xs text-white/50">Ajustes de ranking · {community === "sand" ? "Areia" : "Quadra"}</p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-300"><Radio className="h-3.5 w-3.5" /> ao vivo</span>
      </header>

      <section aria-label="Resumo" className="grid grid-cols-3 gap-1.5">
        <div className="col-span-3 flex items-center justify-between rounded-2xl border border-violet-300/25 bg-gradient-to-br from-[#51339a] via-[#2f205e] to-[#171136] px-4 py-3">
          <div>
            <span className="text-[9.5px] font-bold uppercase tracking-[0.07em] text-white/50">Índice VPA</span>
            <b className="block text-3xl font-extrabold tabular-nums leading-tight text-white">
              {score?.eligible ? score.averageIndex.toFixed(1).replace(".", ",") : "—"}
            </b>
            {!score?.eligible && <span className="text-[11px] text-white/55">{score?.eventsPlayed ?? 0}/{INDEX_MIN_EVENTS} rachas para classificação</span>}
          </div>
          <div className="text-right">
            <span className="text-[9.5px] font-bold uppercase tracking-[0.07em] text-white/50">Posição</span>
            <b className="block text-2xl font-extrabold tabular-nums text-white">{position >= 0 ? `#${position + 1}` : "—"}</b>
          </div>
        </div>
        <Tile value={score?.eventsPlayed ?? 0} label="Presenças" />
        <Tile value={wins} label="Vitórias" />
        <Tile value={losses} label="Derrotas" />
        <Tile value={counts.mvp.get(profileId) ?? 0} label="Destaques" />
        <Tile value={`${percentage}%`} label="Aproveit." />
        <Tile value={counts.attendance.get(profileId) ?? 0} label="Pres. (aba)" />
      </section>
      <p className="-mt-2 text-[11px] leading-snug text-white/45">
        Números do Índice VPA (últimos {ROLLING_INDEX_EVENT_COUNT} rachas). A aba Vitórias do ranking mostra {counts.wins.get(profileId) ?? 0}, contando também confrontos do formato antigo.
      </p>

      <section>
        <h2 className="px-0.5 text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-white/40">Por racha · muda o Índice VPA</h2>
        <div className="mt-2 grid gap-2">
          {sheet.map((event) => (
            <RankingSheetEvent
              key={`${event.id}-${event.effective.present}-${event.effective.wins}-${event.effective.losses}-${event.effective.mvp}`}
              profileId={profileId}
              event={event}
              adjustResult={adjustEventResult}
              setFlag={setEventFlag}
            />
          ))}
          {!sheet.length && <p className="text-sm text-white/60">Nenhum racha encerrado ainda.</p>}
        </div>
      </section>

      <section>
        <h2 className="px-0.5 text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-white/40">Extras sem racha</h2>
        <div className="mt-2 grid gap-2 rounded-2xl border border-white/10 bg-white/[0.035] p-3">
          <p className="text-[11px] leading-snug text-white/50">Somam só nas abas Presença, Destaques e Vitórias do ranking, sem mexer no Índice. Use para acertos antigos.</p>
          {([["attendance", "Presenças"], ["mvp", "Destaques"], ["wins", "Vitórias"]] as const).map(([metric, label]) => (
            <div key={metric} className="flex items-center justify-between gap-3">
              <span className="text-sm text-white/70">{label} <span className="text-[11px] text-white/40">(extra {extraByMetric[metric] > 0 ? "+" : ""}{extraByMetric[metric]})</span></span>
              <RankingAdjustControl profileId={profileId} metric={metric} value={counts[metric].get(profileId) ?? 0} action={adjustRanking} />
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="px-0.5 text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-white/40">Ajustes feitos neste jogador</h2>
        <div className="mt-2 grid gap-2">
          {(adjustments ?? []).map((row) => {
            const ev = row.events as unknown as { date: string } | null;
            return (
              <div key={row.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm">
                <span className="text-white/70">
                  {row.delta > 0 ? "+" : ""}{row.delta} {METRIC_LABELS[row.metric] ?? row.metric}{ev ? ` · racha ${formatDay(ev.date)}` : " · sem racha"}
                </span>
                <DeleteRankingAdjustmentButton adjustmentId={row.id} action={deleteRankingAdjustment} />
              </div>
            );
          })}
          {!adjustments?.length && <p className="text-sm text-white/60">Nenhum ajuste manual neste jogador.</p>}
        </div>
      </section>
    </div>
  );
}
