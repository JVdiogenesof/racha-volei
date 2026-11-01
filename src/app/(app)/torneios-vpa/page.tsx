import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Award, BadgeCheck, CalendarDays, Crown, Gauge, ListChecks, Sparkles, Target, Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { Avatar } from "@/components/Avatar";
import { AddReservedPlayerForm } from "@/components/AddReservedPlayerForm";
import { RemoveReservedPlayerButton } from "@/components/RemoveReservedPlayerButton";
import { ClearReservedListButton } from "@/components/ClearReservedListButton";
import { SetterBadge } from "@/components/SetterBadge";
import { TorneiosVpaTabs } from "@/components/TorneiosVpaTabs";
import { TorneioOficialHero } from "@/components/TorneioOficialHero";
import { addReservedPlayer, removeReservedPlayer, clearReservedList } from "./actions";
import { COMMUNITY_INFO, getActiveCommunity } from "@/lib/community";
import { TOURNAMENT_QUALIFYING_SLOTS, TOURNAMENT_TOP_TIER_SLOTS } from "@/lib/rankings";
import { getSeasonRanking, INDEX_MIN_EVENTS } from "@/lib/seasonRanking";

type ReservedRow = {
  profile_id: string;
  source_event_id: string | null;
  profiles: { full_name: string; avatar_url: string | null } | null;
  events: { date: string } | null;
};
type Group = { key: string; eventId: string | null; date: string | null; members: ReservedRow[] };
type ProfileRow = { id: string; full_name: string; avatar_url: string | null; is_setter: boolean };

// Quantos logo abaixo do corte aparecem como "na briga pela vaga".
const CHASING_PREVIEW = 4;

function shortDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export default async function TorneiosVpaPage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const community = await getActiveCommunity(profile);
  const today = new Date().toISOString().slice(0, 10);

  const [{ data: reserved }, { data: profiles }, season, { data: upcomingPreTournaments }] = await Promise.all([
    supabase
      .from("tournament_reserved_players")
      .select(
        "profile_id, added_at, source_event_id, profiles!tournament_reserved_players_profile_id_profiles_id_fk(full_name, avatar_url), events!tournament_reserved_players_source_event_id_events_id_fk(date)",
      )
      .eq("community", community)
      .order("added_at", { ascending: true }),
    supabase.from("profiles").select("id, full_name, avatar_url, is_setter").eq("status", "approved").contains("communities", [community]).order("full_name"),
    getSeasonRanking(supabase, community),
    supabase
      .from("events")
      .select("id, date, time, status")
      .eq("community", community)
      .eq("is_pre_torneio", true)
      .gte("date", today)
      .neq("status", "cancelled")
      .neq("status", "finished")
      .order("date", { ascending: true })
      .limit(4),
  ]);

  const reservedRows = (reserved ?? []) as unknown as ReservedRow[];
  const reservedIds = new Set(reservedRows.map((r) => r.profile_id));
  const profileById = new Map(((profiles ?? []) as ProfileRow[]).map((p) => [p.id, p]));
  const addOptions = ((profiles ?? []) as ProfileRow[]).filter((p) => !reservedIds.has(p.id)).map((p) => ({ id: p.id, fullName: p.full_name }));

  // Mesma ordem do Ranking e da tela de início: ranqueados aprovados, nota e depois vitórias.
  const ranked = [...season.values()]
    .filter((score) => score.eligible && profileById.has(score.profileId))
    .sort((a, b) => b.averageIndex - a.averageIndex || b.totalWins - a.totalWins);
  const zone = ranked.slice(0, TOURNAMENT_QUALIFYING_SLOTS);
  const chasing = ranked.slice(TOURNAMENT_QUALIFYING_SLOTS, TOURNAMENT_QUALIFYING_SLOTS + CHASING_PREVIEW);
  const cutoffScore = ranked.length >= TOURNAMENT_QUALIFYING_SLOTS ? ranked[TOURNAMENT_QUALIFYING_SLOTS - 1].averageIndex : null;
  const indexOnlyCount = zone.filter((score) => !reservedIds.has(score.profileId)).length;

  // Cada pré-torneio reserva o time campeão de uma vez: agrupar pelo racha de
  // origem já mostra "esse time venceu esse pré-torneio". Reservas manuais
  // ficam num grupo à parte, por último.
  const groupByKey = new Map<string, Group>();
  const groups: Group[] = [];
  for (const row of reservedRows) {
    const key = row.source_event_id ?? "manual";
    let group = groupByKey.get(key);
    if (!group) {
      group = { key, eventId: row.source_event_id, date: row.events?.date ?? null, members: [] };
      groupByKey.set(key, group);
      groups.push(group);
    }
    group.members.push(row);
  }
  groups.sort((a, b) => {
    if (a.key === "manual") return 1;
    if (b.key === "manual") return -1;
    return (b.date ?? "").localeCompare(a.date ?? "");
  });

  const myScore = season.get(profile.id) ?? null;
  const myRankIndex = ranked.findIndex((score) => score.profileId === profile.id);
  const myPosition = myRankIndex >= 0 ? myRankIndex + 1 : null;
  const myGuaranteed = reservedIds.has(profile.id);
  const myInZone = myPosition !== null && myPosition <= TOURNAMENT_QUALIFYING_SLOTS;
  const myGap = !myGuaranteed && !myInZone && myScore?.eligible && cutoffScore !== null
    ? Math.max(0, Math.round((cutoffScore - myScore.averageIndex) * 10) / 10)
    : null;

  return (
    <div className="space-y-6">
      <TorneiosVpaTabs />

      <TorneioOficialHero
        eyebrow={`${COMMUNITY_INFO[community].shortLabel} · Temporada 2026/27`}
        whenLabel="Abril"
        whenDetail="de 2027"
        guaranteedCount={reservedIds.size}
        indexSlots={TOURNAMENT_QUALIFYING_SLOTS}
        indexOnlyCount={indexOnlyCount}
      />

      {/* Sua situação */}
      {myGuaranteed ? (
        <StatusCard tone="gold" icon={<BadgeCheck className="mt-0.5 h-6 w-6 shrink-0 text-amber-300" strokeWidth={2} />} title="Vaga garantida!">
          Você venceu um pré-torneio (ou foi escolhido pela organização). Sua vaga no torneio oficial não depende mais da nota do Índice.
        </StatusCard>
      ) : myInZone ? (
        <StatusCard tone="violet" icon={<Gauge className="mt-0.5 h-6 w-6 shrink-0 text-violet-300" strokeWidth={2} />} title={`Você está na zona: ${myPosition}º no Índice VPA`}>
          Hoje você entraria no torneio pelo ranking. A nota é viva — continue jogando pra se manter entre os {TOURNAMENT_QUALIFYING_SLOTS} primeiros.
        </StatusCard>
      ) : (
        <StatusCard tone="neutral" icon={<Target className="mt-0.5 h-6 w-6 shrink-0 text-amber-300" strokeWidth={2} />} title="Ainda fora da zona de classificação">
          {myPosition !== null
            ? `Você é o ${myPosition}º no Índice VPA${myGap !== null && myGap > 0 ? ` e está a ${myGap.toFixed(1)} pts do corte` : ""}. Vença um pré-torneio pra garantir a vaga direto, ou suba no ranking.`
            : myScore
              ? `Jogue mais rachas pra entrar no Índice (${myScore.eventsPlayed}/${INDEX_MIN_EVENTS}). Ou vença um pré-torneio e garanta a vaga direto.`
              : "Jogue rachas pra entrar no Índice VPA, ou vença um pré-torneio e garanta a vaga direto."}
        </StatusCard>
      )}

      {/* Próximos pré-torneios */}
      {(upcomingPreTournaments?.length ?? 0) > 0 && (
        <section className="space-y-3">
          <SectionTitle icon={CalendarDays} title="Próximos pré-torneios" subtitle="O time campeão garante as vagas direto no torneio oficial." />
          <div className="grid gap-2 sm:grid-cols-2">
            {upcomingPreTournaments!.map((event) => (
              <Link
                key={event.id}
                href={`/racha/${event.id}`}
                className="flex items-center gap-3 rounded-2xl border border-amber-300/25 bg-gradient-to-r from-amber-400/15 to-violet-500/10 px-4 py-3 transition hover:border-amber-300/45"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-400/20 text-amber-200">
                  <Award className="h-5 w-5" strokeWidth={2} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-black capitalize text-white">
                    {new Date(`${event.date}T00:00:00`).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" }).replace(".", "")}
                  </p>
                  <p className="text-xs text-white/55">{event.time ? `Às ${event.time.slice(0, 5)}` : "Horário a definir"} · pré-torneio</p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-amber-200" strokeWidth={2.25} />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Garantidos pelo pré-torneio */}
      <section className="space-y-3">
        <SectionTitle icon={Crown} title={`Vagas garantidas · ${reservedIds.size}`} subtitle="Campeões de pré-torneio e escolhas da organização. Não dependem do ranking." />

        {profile.is_organizer && (
          <div className="space-y-3">
            <AddReservedPlayerForm action={addReservedPlayer} players={addOptions} />
            {reservedRows.length > 0 && <ClearReservedListButton action={clearReservedList} />}
          </div>
        )}

        {groups.map((group) => (
          <article key={group.key} className="rounded-2xl border border-amber-300/20 bg-gradient-to-br from-amber-400/10 via-violet-500/5 to-transparent p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                {group.key === "manual" ? (
                  <>
                    <Sparkles className="h-4 w-4 text-violet-300" strokeWidth={2} />
                    Escolhidos pela organização
                  </>
                ) : (
                  <>
                    <Trophy className="h-4 w-4 text-amber-300" strokeWidth={2} />
                    Campeões do pré-torneio de {group.date ? shortDate(group.date) : "data desconhecida"}
                  </>
                )}
              </h3>
              {group.eventId && (
                <Link href={`/racha/${group.eventId}`} className="inline-flex items-center gap-1 text-xs font-semibold text-amber-200 hover:underline">
                  Ver racha <ArrowRight className="h-3 w-3" strokeWidth={2} />
                </Link>
              )}
            </div>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {group.members.map((r) => (
                <li
                  key={r.profile_id}
                  className={`flex min-w-0 items-center gap-3 rounded-xl border px-3 py-2.5 ${r.profile_id === profile.id ? "border-amber-300/50 bg-amber-400/10" : "border-white/10 bg-black/10"}`}
                >
                  <Avatar src={r.profiles?.avatar_url ?? null} name={r.profiles?.full_name ?? "?"} size="sm" ring="ring-amber-300/40" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">{r.profiles?.full_name}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-semibold text-amber-200">
                        <BadgeCheck className="h-3 w-3" strokeWidth={2.5} /> Garantido
                      </span>
                      {profileById.get(r.profile_id)?.is_setter && <SetterBadge />}
                    </div>
                  </div>
                  {profile.is_organizer && (
                    <RemoveReservedPlayerButton
                      profileId={r.profile_id}
                      fullName={r.profiles?.full_name ?? "esse jogador"}
                      action={removeReservedPlayer}
                    />
                  )}
                </li>
              ))}
            </ul>
          </article>
        ))}
        {!groups.length && (
          <p className="rounded-2xl border border-dashed border-white/15 p-4 text-sm text-white/55">
            Ninguém garantiu vaga ainda. O time campeão de cada pré-torneio entra aqui sozinho quando a final for decidida.
          </p>
        )}
      </section>

      {/* Zona do Índice VPA */}
      <section className="space-y-3">
        <SectionTitle
          icon={Gauge}
          title={`Zona do Índice VPA · top ${TOURNAMENT_QUALIFYING_SLOTS}`}
          subtitle="Classificação provisória: a nota é viva e muda a cada racha até o torneio."
        />
        {zone.length ? (
          <ol className="divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10">
            {zone.map((score, index) => {
              const player = profileById.get(score.profileId)!;
              const topTier = index < TOURNAMENT_TOP_TIER_SLOTS;
              const mine = score.profileId === profile.id;
              return (
                <li key={score.profileId} className={`flex items-center gap-3 px-3 py-2.5 ${mine ? "bg-amber-400/10" : topTier ? "bg-violet-500/[0.06]" : ""}`}>
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                      index < 3 ? "bg-gradient-to-br from-amber-200 to-amber-500 text-amber-950" : topTier ? "bg-violet-400/30 text-violet-100" : "bg-white/10 text-white/70"
                    }`}
                  >
                    {index + 1}
                  </span>
                  <Avatar src={player.avatar_url} name={player.full_name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">{player.full_name}</p>
                    <p className="text-[11px] text-white/45">
                      {score.averageIndex.toFixed(1)} pts · {score.totalWins}V-{score.totalLosses}D
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap justify-end gap-1">
                    {player.is_setter && <SetterBadge />}
                    {reservedIds.has(score.profileId) && (
                      <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-semibold text-amber-200">Garantido</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="text-sm text-white/55">Ainda não há jogadores ranqueados no Índice VPA.</p>
        )}

        {chasing.length > 0 && (
          <div className="rounded-2xl border border-dashed border-white/15 p-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-white/45">Na briga pela vaga</p>
            <ul className="mt-2 space-y-1.5">
              {chasing.map((score, index) => {
                const player = profileById.get(score.profileId)!;
                const gap = cutoffScore !== null ? Math.max(0, Math.round((cutoffScore - score.averageIndex) * 10) / 10) : null;
                return (
                  <li key={score.profileId} className={`flex items-center gap-3 rounded-xl px-2 py-1.5 ${score.profileId === profile.id ? "bg-amber-400/10" : ""}`}>
                    <span className="w-7 shrink-0 text-center text-xs font-bold text-white/50">{TOURNAMENT_QUALIFYING_SLOTS + index + 1}</span>
                    <Avatar src={player.avatar_url} name={player.full_name} size="sm" />
                    <p className="min-w-0 flex-1 truncate text-sm text-white/80">{player.full_name}</p>
                    {gap !== null && <span className="shrink-0 text-[11px] font-semibold text-amber-200/80">−{gap.toFixed(1)} pts</span>}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <Link href="/ranking" className="inline-flex items-center gap-1 text-xs font-semibold text-amber-200 hover:underline">
          Ver Índice VPA completo <ArrowRight className="h-3 w-3" strokeWidth={2} />
        </Link>
      </section>

      {/* Como funciona */}
      <section className="rounded-2xl border border-white/10 p-4 sm:p-5">
        <SectionTitle icon={ListChecks} title="Como funciona" />
        <ol className="mt-3 space-y-2.5 text-sm leading-relaxed text-white/75">
          <Rule n={1}>O torneio oficial está previsto para abril de 2027. Data e local ainda vão ser definidos.</Rule>
          <Rule n={2}>O time campeão de cada racha pré-torneio garante vaga direto, sem depender da nota do Índice.</Rule>
          <Rule n={3}>As {TOURNAMENT_QUALIFYING_SLOTS} primeiras posições do Índice VPA também garantem vaga. A nota vale os últimos rachas, então a zona muda até o torneio.</Rule>
          <Rule n={4}>Quem for removido do grupo por faltas perde a vaga, que é redistribuída pelos critérios do ranking.</Rule>
          <Rule n={5}>O uniforme oficial do VPA é obrigatório no torneio.</Rule>
        </ol>
        <Link href="/regulamento" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-amber-200 hover:underline">
          Ler o regulamento completo <ArrowRight className="h-3 w-3" strokeWidth={2} />
        </Link>
      </section>
    </div>
  );
}

function SectionTitle({ icon: Icon, title, subtitle }: { icon: typeof Trophy; title: string; subtitle?: string }) {
  return (
    <div>
      <h2 className="flex items-center gap-2 text-base font-bold text-white">
        <Icon className="h-4 w-4 text-amber-300" strokeWidth={2.25} />
        {title}
      </h2>
      {subtitle && <p className="mt-0.5 text-xs leading-relaxed text-white/55">{subtitle}</p>}
    </div>
  );
}

function Rule({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-400/15 text-xs font-black text-amber-200">{n}</span>
      <span>{children}</span>
    </li>
  );
}

function StatusCard({ tone, icon, title, children }: { tone: "gold" | "violet" | "neutral"; icon: ReactNode; title: string; children: ReactNode }) {
  const style =
    tone === "gold"
      ? "border-amber-300/35 bg-gradient-to-r from-amber-400/15 to-violet-500/10"
      : tone === "violet"
        ? "border-violet-300/30 bg-violet-500/10"
        : "border-white/10 bg-white/[0.03]";
  return (
    <section className={`flex items-start gap-3 rounded-2xl border p-4 ${style}`}>
      {icon}
      <div>
        <p className="font-bold text-white">{title}</p>
        <p className="mt-0.5 text-sm leading-relaxed text-white/70">{children}</p>
      </div>
    </section>
  );
}
