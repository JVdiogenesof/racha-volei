import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Crown,
  ListChecks,
  Medal,
  RefreshCw,
  Target,
  Trophy,
  UserMinus,
  UserPlus,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { getActiveCommunity, COMMUNITY_INFO } from "@/lib/community";
import { cupCapacity, cupFinalDateLabel, daysUntilInBrazil, getCupRankingQueue, getEventChampionIds, getFeaturedCup, type Cup, type CupQualifiedSource } from "@/lib/copaVpa";
import { Avatar } from "@/components/Avatar";
import { ActionForm } from "@/components/ActionForm";
import { ConfirmActionButton } from "@/components/ConfirmActionButton";
import { FormSelect } from "@/components/FormSelect";
import { SetterBadge } from "@/components/SetterBadge";
import { TorneiosVpaTabs } from "@/components/TorneiosVpaTabs";
import { CopaHero } from "@/components/CopaHero";
import {
  addCupPlayer,
  addCupQualifier,
  createCup,
  fillCupSpotFromRanking,
  removeCupPlayer,
  removeCupQualifier,
  reprocessQualifier,
  setCupFinalDate,
  setCupFinalEvent,
  syncCupFinal,
} from "./actions";

type EventInfo = { id: string; date: string; time: string | null; status: string };
type QualifiedRow = {
  profile_id: string;
  source: CupQualifiedSource;
  source_event_id: string | null;
  replaces_profile_id: string | null;
  ranking_position: number | null;
  added_at: string;
  player: { full_name: string; avatar_url: string | null; is_setter: boolean } | null;
  replaced: { full_name: string } | null;
};

const QUEUE_PREVIEW = 8;

function shortDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function longDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
}

function formatTime(time: string | null) {
  return time ? time.slice(0, 5).replace(":", "h") : null;
}

export default async function CopaVpaPage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const community = await getActiveCommunity();
  const cup = await getFeaturedCup(supabase, community);

  if (!cup) {
    return (
      <div className="space-y-6">
        <TorneiosVpaTabs />
        <section className="rounded-2xl border border-white/10 p-8 text-center">
          <Medal className="mx-auto h-12 w-12 text-white/25" strokeWidth={1.5} />
          <h1 className="mt-4 text-2xl font-bold text-white">Copa VPA</h1>
          <p className="mt-2 text-sm text-white/60">Nenhuma copa marcada em {COMMUNITY_INFO[community].shortLabel.toLowerCase()} por enquanto.</p>
        </section>
        {profile.is_organizer && <CreateCupForm />}
      </div>
    );
  }

  const capacity = cupCapacity(cup);
  const [{ data: qualifierRows }, { data: qualifiedRows }, { data: finalEvent }] = await Promise.all([
    supabase.from("cup_qualifiers").select("event_id, events(id, date, time, status)").eq("cup_id", cup.id),
    supabase
      .from("cup_qualified_players")
      .select(
        "profile_id, source, source_event_id, replaces_profile_id, ranking_position, added_at, player:profiles!cup_qualified_players_profile_id_fkey(full_name, avatar_url, is_setter), replaced:profiles!cup_qualified_players_replaces_profile_id_fkey(full_name)",
      )
      .eq("cup_id", cup.id)
      .order("added_at", { ascending: true }),
    cup.final_event_id
      ? supabase.from("events").select("id, date, time, status").eq("id", cup.final_event_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const qualifierEvents = (qualifierRows ?? [])
    .map((row) => row.events as unknown as EventInfo | null)
    .filter((event): event is EventInfo => Boolean(event))
    .sort((a, b) => a.date.localeCompare(b.date));
  const qualified = (qualifiedRows ?? []) as unknown as QualifiedRow[];
  const qualifiedIds = new Set(qualified.map((row) => row.profile_id));

  const qualifierEventIds = qualifierEvents.map((event) => event.id);
  const [{ data: finalMatches }, rankingQueue, { data: finalLocks }, finalChampionIds] = await Promise.all([
    qualifierEventIds.length
      ? supabase
          .from("tournament_matches")
          .select("event_id, score_a, score_b")
          .in("event_id", qualifierEventIds)
          .eq("stage", "final")
      : Promise.resolve({ data: [] as { event_id: string; score_a: number | null; score_b: number | null }[] }),
    getCupRankingQueue(supabase, community, qualifiedIds),
    cup.final_event_id
      ? supabase.from("event_locked_players").select("profile_id").eq("event_id", cup.final_event_id)
      : Promise.resolve({ data: [] as { profile_id: string }[] }),
    cup.final_event_id ? getEventChampionIds(supabase, cup.final_event_id) : Promise.resolve(null),
  ]);

  const decidedQualifiers = new Set(
    (finalMatches ?? []).filter((match) => match.score_a != null && match.score_b != null).map((match) => match.event_id),
  );
  const finalLockedIds = new Set((finalLocks ?? []).map((row) => row.profile_id));
  const missingFromFinal = cup.final_event_id ? qualified.filter((row) => !finalLockedIds.has(row.profile_id)).length : 0;

  // Datas planejadas sem racha criado ainda aparecem como "aguardando".
  const eventByDate = new Map(qualifierEvents.map((event) => [event.date, event]));
  const qualifierSlots = [...new Set([...cup.qualifier_dates, ...qualifierEvents.map((event) => event.date)])]
    .sort()
    .map((date, index) => ({ round: index + 1, date, event: eventByDate.get(date) ?? null }));

  const rowsByEvent = new Map<string, QualifiedRow[]>();
  for (const row of qualified) {
    if (!row.source_event_id) continue;
    rowsByEvent.set(row.source_event_id, [...(rowsByEvent.get(row.source_event_id) ?? []), row]);
  }
  const eventDateById = new Map(qualifierEvents.map((event) => [event.id, event.date]));

  const myRow = qualified.find((row) => row.profile_id === profile.id) ?? null;
  const myQueueIndex = rankingQueue.findIndex((candidate) => candidate.profileId === profile.id);
  const remaining = cup.final_date ? daysUntilInBrazil(cup.final_date) : null;
  const monthReference = cup.final_date ?? cup.qualifier_dates[0] ?? qualifierEvents[0]?.date ?? null;
  const finalLabel = cupFinalDateLabel(cup);
  const finalChampions = finalChampionIds ? qualified.filter((row) => finalChampionIds.includes(row.profile_id)) : [];

  const sortedQualified = [...qualified].sort((a, b) => {
    const sourceOrder = { champion: 0, ranking: 1, manual: 2 } as const;
    const dateA = a.source_event_id ? (eventDateById.get(a.source_event_id) ?? "9999") : "9999";
    const dateB = b.source_event_id ? (eventDateById.get(b.source_event_id) ?? "9999") : "9999";
    return dateA.localeCompare(dateB) || sourceOrder[a.source] - sourceOrder[b.source] || a.added_at.localeCompare(b.added_at);
  });
  const emptySlots = Math.max(0, capacity - sortedQualified.length);

  return (
    <div className="space-y-6">
      <TorneiosVpaTabs />

      <CopaHero
        name={cup.name}
        eyebrow={`${COMMUNITY_INFO[community].shortLabel}${monthReference ? ` · Dinâmica de ${new Date(`${monthReference}T00:00:00`).toLocaleDateString("pt-BR", { month: "long" })}` : ""}`}
        finalDateShort={cup.final_date ? shortDate(cup.final_date) : null}
        finalWeekday={cup.final_date ? longDate(cup.final_date).split(",")[0].replace(/^./, (letter) => letter.toUpperCase()) : null}
        qualifierCount={qualifierSlots.length}
        remaining={remaining}
        numTeams={cup.num_teams}
        teamSize={cup.team_size}
        capacity={capacity}
        qualifiedCount={qualified.length}
      />

      {/* Campeões da copa */}
      {finalChampions.length > 0 && cup.final_event_id && (
        <section className="rounded-2xl border border-pink-400/40 bg-gradient-to-br from-pink-400/20 to-transparent p-5 text-center">
          <Crown className="mx-auto h-8 w-8 text-pink-300" strokeWidth={1.8} />
          <h2 className="mt-2 text-xl font-black text-white">Campeões da {cup.name}</h2>
          <ul className="mt-4 flex flex-wrap justify-center gap-3">
            {finalChampions.map((row) => (
              <li key={row.profile_id} className="flex w-20 flex-col items-center gap-1.5">
                <Avatar src={row.player?.avatar_url} name={row.player?.full_name ?? "?"} size="lg" ring="ring-pink-300/70" />
                <span className="break-words text-xs font-semibold text-white">{row.player?.full_name}</span>
              </li>
            ))}
          </ul>
          <Link href={`/racha/${cup.final_event_id}/resultado`} className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-pink-200 hover:underline">
            Ver resultado completo <ArrowRight className="h-3 w-3" strokeWidth={2} />
          </Link>
        </section>
      )}

      {/* Sua situação */}
      <MyStatus
        row={myRow}
        queueIndex={myQueueIndex}
        isSetter={Boolean(rankingQueue[myQueueIndex]?.isSetter)}
        eventDateById={eventDateById}
        finalDate={cup.final_date}
      />

      {/* Classificatórias */}
      <section className="space-y-3">
        <SectionTitle icon={ListChecks} title="Rachas classificatórios" subtitle="O time campeão de cada um garante vaga na final." />
        <div className="grid gap-3 sm:grid-cols-2">
          {qualifierSlots.map(({ round, date, event }) => {
            const rows = event ? (rowsByEvent.get(event.id) ?? []) : [];
            const champions = rows.filter((row) => row.source === "champion");
            const rankingRows = rows.filter((row) => row.source === "ranking");
            const decided = event ? decidedQualifiers.has(event.id) : false;
            const status = !event
              ? { label: "Racha ainda não criado", tone: "text-white/45 bg-white/5" }
              : event.status === "cancelled"
                ? { label: "Cancelado", tone: "text-red-200 bg-red-500/15" }
                : decided
                  ? { label: "Campeão definido", tone: "text-emerald-200 bg-emerald-500/15" }
                  : event.status === "open"
                    ? { label: "Inscrições", tone: "text-cyan-200 bg-cyan-500/15" }
                    : { label: "Em disputa", tone: "text-pink-200 bg-pink-500/15" };
            return (
              <article key={date} className="flex min-w-0 flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-white/45">Classificatória {round}</p>
                    <p className="mt-0.5 text-lg font-black text-white">
                      {shortDate(date)}
                      {event?.time && <span className="ml-2 text-sm font-semibold text-white/50">{formatTime(event.time)}</span>}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${status.tone}`}>{status.label}</span>
                </div>

                {champions.length > 0 || rankingRows.length > 0 ? (
                  <div className="mt-3 space-y-3">
                    <ul className="flex flex-wrap gap-2">
                      {champions.map((row) => (
                        <li key={row.profile_id} className="flex min-w-0 items-center gap-2 rounded-full bg-pink-400/10 py-1 pl-1 pr-3">
                          <Avatar src={row.player?.avatar_url} name={row.player?.full_name ?? "?"} size="sm" ring="ring-pink-300/50" />
                          <span className="break-words text-xs font-semibold text-white">{row.player?.full_name}</span>
                        </li>
                      ))}
                    </ul>
                    {rankingRows.length > 0 && (
                      <ul className="space-y-1.5 rounded-xl border border-cyan-300/20 bg-cyan-400/5 p-2.5 text-xs text-cyan-50/85">
                        {rankingRows.map((row) => (
                          <li key={row.profile_id} className="flex flex-wrap items-center gap-1">
                            <span className="font-semibold text-white">{row.replaced?.full_name ?? "Um campeão"}</span>
                            já estava classificado(a) → vaga para
                            <span className="font-semibold text-cyan-200">{row.player?.full_name}</span>
                            {row.ranking_position && <span className="text-cyan-100/60">(Nº {row.ranking_position} do ranking)</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : (
                  <p className="mt-3 text-xs leading-relaxed text-white/50">
                    {decided ? "Final decidida — os classificados aparecem aqui." : "Os campeões aparecem aqui assim que a final do racha for lançada."}
                  </p>
                )}

                <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
                  {event && (
                    <Link href={`/racha/${event.id}`} className="inline-flex items-center gap-1 text-xs font-semibold text-purple-300 hover:underline">
                      Ver racha <ArrowRight className="h-3 w-3" strokeWidth={2} />
                    </Link>
                  )}
                  {profile.is_organizer && event && decided && (
                    <ConfirmActionButton
                      action={reprocessQualifier}
                      fields={{ cupId: cup.id, eventId: event.id }}
                      confirmMessage="Recalcular as vagas desta classificatória a partir da final lançada? Vagas do ranking também são refeitas."
                      successMessage="Classificatória recalculada."
                      className="ml-auto inline-flex min-h-8 items-center gap-1 rounded-lg border border-white/15 px-2.5 text-[11px] font-semibold text-white/70 hover:bg-white/5"
                    >
                      <RefreshCw className="h-3 w-3" strokeWidth={2.25} /> Recalcular
                    </ConfirmActionButton>
                  )}
                  {profile.is_organizer && event && (
                    <ConfirmActionButton
                      action={removeCupQualifier}
                      fields={{ cupId: cup.id, eventId: event.id }}
                      confirmMessage="Tirar este racha das classificatórias? As vagas que vieram dele saem da copa."
                      successMessage="Racha removido das classificatórias."
                      className={`${decided ? "" : "ml-auto "}inline-flex min-h-8 items-center rounded-lg px-2.5 text-[11px] font-semibold text-red-300/80 hover:bg-red-500/10`}
                    >
                      Desvincular
                    </ConfirmActionButton>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* Classificados */}
      <section className="space-y-3">
        <SectionTitle
          icon={BadgeCheck}
          title={`Classificados · ${qualified.length}/${capacity}`}
          subtitle={cup.final_date ? `Entram automaticamente na lista da final de ${finalLabel}.` : "Entram automaticamente na lista da final (data a definir)."}
        />
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {sortedQualified.map((row) => (
            <li key={row.profile_id} className={`flex min-w-0 items-center gap-3 rounded-xl border px-3 py-2.5 ${row.profile_id === profile.id ? "border-pink-300/50 bg-pink-400/10" : "border-white/10 bg-white/[0.02]"}`}>
              <Avatar src={row.player?.avatar_url} name={row.player?.full_name ?? "?"} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="break-words text-sm font-semibold text-white">{row.player?.full_name}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  <SourceChip row={row} eventDateById={eventDateById} />
                  {row.player?.is_setter && <SetterBadge />}
                  {cup.final_event_id && !finalLockedIds.has(row.profile_id) && profile.is_organizer && (
                    <span className="rounded-full bg-orange-500/15 px-2 py-0.5 text-[10px] font-semibold text-orange-200">Fora da lista</span>
                  )}
                </div>
              </div>
              {profile.is_organizer && (
                <ConfirmActionButton
                  action={removeCupPlayer}
                  fields={{ cupId: cup.id, profileId: row.profile_id }}
                  confirmMessage={`Tirar ${row.player?.full_name ?? "essa pessoa"} da ${cup.name}? Se ela já estiver na lista da final e não tiver pago, sai de lá também.`}
                  successMessage="Removido(a) da copa."
                  ariaLabel={`Remover ${row.player?.full_name ?? ""}`}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/40 hover:bg-red-500/15 hover:text-red-400"
                >
                  <UserMinus className="h-4 w-4" strokeWidth={2} />
                </ConfirmActionButton>
              )}
            </li>
          ))}
          {Array.from({ length: emptySlots }, (_, index) => (
            <li key={`empty-${index}`} className="flex items-center gap-3 rounded-xl border border-dashed border-white/10 px-3 py-2.5 text-white/30">
              <span className="flex h-8 w-8 items-center justify-center rounded-full border border-dashed border-white/15 text-xs font-bold">
                {sortedQualified.length + index + 1}
              </span>
              <span className="text-sm">Vaga em disputa</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Fila do ranking */}
      <section className="space-y-3">
        <SectionTitle
          icon={Medal}
          title="Fila do ranking"
          subtitle="Se um campeão já classificado vencer de novo, a vaga vai para o próximo daqui. Levantadores têm prioridade."
        />
        {rankingQueue.length ? (
          <ol className="divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10">
            {rankingQueue.slice(0, QUEUE_PREVIEW).map((candidate, index) => (
              <li key={candidate.profileId} className={`flex items-center gap-3 px-3 py-2.5 ${candidate.profileId === profile.id ? "bg-pink-400/10" : index === 0 ? "bg-cyan-400/5" : ""}`}>
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${index === 0 ? "bg-cyan-400 text-cyan-950" : "bg-white/10 text-white/70"}`}>
                  {index + 1}
                </span>
                <Avatar src={candidate.avatarUrl} name={candidate.fullName} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm font-semibold text-white">{candidate.fullName}</p>
                  <p className="text-[11px] text-white/45">
                    {candidate.position ? `Nº ${candidate.position} no Índice VPA · ${candidate.averageIndex.toFixed(1)} pts` : "Em classificação no Índice VPA"}
                  </p>
                </div>
                {candidate.isSetter && <SetterBadge />}
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-white/50">Ninguém na fila do ranking agora.</p>
        )}
        <Link href="/ranking" className="inline-flex items-center gap-1 text-xs font-semibold text-purple-300 hover:underline">
          Ver Índice VPA completo <ArrowRight className="h-3 w-3" strokeWidth={2} />
        </Link>
      </section>

      {/* Final */}
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
        <SectionTitle icon={Trophy} title={`A final · ${cup.final_date ? longDate(cup.final_date) : "data a definir"}`} subtitle={`${cup.num_teams} times de ${cup.team_size}, montados com os ${capacity} classificados.`} />
        {finalEvent ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Link href={`/racha/${finalEvent.id}/confirmar`} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-brand-purple px-4 text-sm font-bold text-white hover:bg-brand-purple-dark">
              Lista da final <ArrowRight className="h-4 w-4" strokeWidth={2} />
            </Link>
            <Link href={`/racha/${finalEvent.id}/times`} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-white/15 px-4 text-sm font-semibold text-white hover:bg-white/5">
              Times e jogos
            </Link>
            {formatTime(finalEvent.time) && <span className="text-xs text-white/50">Começa às {formatTime(finalEvent.time)}</span>}
          </div>
        ) : (
          <p className="mt-3 text-sm text-white/55">O racha da final ainda não foi criado. Quando for, os classificados entram na lista automaticamente.</p>
        )}
      </section>

      {/* Regulamento */}
      <section className="rounded-2xl border border-white/10 p-4 sm:p-5">
        <SectionTitle icon={ListChecks} title="Como funciona" />
        <ol className="mt-3 space-y-2.5 text-sm leading-relaxed text-white/75">
          <Rule n={1}>
            Os rachas classificatórios são {qualifierSlots.length ? qualifierSlots.map((slot) => shortDate(slot.date)).join(", ").replace(/, ([^,]*)$/, " e $1") : "definidos pela organização"}.
            O time campeão de cada um garante vaga na {cup.name}.
          </Rule>
          <Rule n={2}>Quem já se classificou pode continuar jogando as classificatórias seguintes normalmente.</Rule>
          <Rule n={3}>Se um classificado vencer de novo, a vaga dele vai para o ranking (Índice VPA): entra o próximo melhor colocado que ainda não está na copa. Essas vagas só são definidas depois da última classificatória, com o ranking final.</Rule>
          <Rule n={4}>Nas vagas do ranking, levantadores têm prioridade.</Rule>
          <Rule n={5}>
            Os {capacity} classificados entram automaticamente na lista da final{cup.final_date ? ` (${finalLabel})` : ", com data ainda a definir,"} e disputam a copa em {cup.num_teams} times.
          </Rule>
          <Rule n={6}>A copa marca a estreia oficial do uniforme VPA, e o time campeão leva troféu.</Rule>
        </ol>
      </section>

      {profile.is_organizer && (
        <OrganizerPanel cup={cup} qualifiedIds={qualifiedIds} capacity={capacity} missingFromFinal={missingFromFinal} />
      )}
    </div>
  );
}

function SectionTitle({ icon: Icon, title, subtitle }: { icon: typeof Trophy; title: string; subtitle?: string }) {
  return (
    <div>
      <h2 className="flex items-center gap-2 text-base font-bold text-white">
        <Icon className="h-4 w-4 text-pink-300" strokeWidth={2.25} />
        {title}
      </h2>
      {subtitle && <p className="mt-0.5 text-xs leading-relaxed text-white/55">{subtitle}</p>}
    </div>
  );
}

function Rule({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-pink-400/15 text-xs font-black text-pink-200">{n}</span>
      <span>{children}</span>
    </li>
  );
}

function SourceChip({ row, eventDateById }: { row: QualifiedRow; eventDateById: Map<string, string> }) {
  const eventDate = row.source_event_id ? eventDateById.get(row.source_event_id) : undefined;
  if (row.source === "champion") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-pink-400/15 px-2 py-0.5 text-[10px] font-semibold text-pink-200">
        <Crown className="h-3 w-3" strokeWidth={2.25} /> Campeão {eventDate ? shortDate(eventDate) : ""}
      </span>
    );
  }
  if (row.source === "ranking") {
    return (
      <span className="rounded-full bg-cyan-400/15 px-2 py-0.5 text-[10px] font-semibold text-cyan-200">
        Ranking{row.ranking_position ? ` · Nº ${row.ranking_position}` : ""}
      </span>
    );
  }
  return <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/70">Organização</span>;
}

function MyStatus({
  row,
  queueIndex,
  isSetter,
  eventDateById,
  finalDate,
}: {
  row: QualifiedRow | null;
  queueIndex: number;
  isSetter: boolean;
  eventDateById: Map<string, string>;
  finalDate: string | null;
}) {
  if (row) {
    const eventDate = row.source_event_id ? eventDateById.get(row.source_event_id) : undefined;
    const how =
      row.source === "champion"
        ? `Seu time venceu a classificatória${eventDate ? ` de ${shortDate(eventDate)}` : ""}.`
        : row.source === "ranking"
          ? "Você herdou uma vaga pelo ranking."
          : "Vaga garantida pela organização.";
    return (
      <section className="flex items-start gap-3 rounded-2xl border border-emerald-300/30 bg-emerald-400/10 p-4">
        <BadgeCheck className="mt-0.5 h-6 w-6 shrink-0 text-emerald-300" strokeWidth={2} />
        <div>
          <p className="font-bold text-emerald-50">Você está classificado(a)!</p>
          <p className="mt-0.5 text-sm leading-relaxed text-emerald-50/75">
            {how} Seu nome já entra na lista da final{finalDate ? ` de ${shortDate(finalDate)}` : " (data a definir)"}. Você pode continuar jogando as classificatórias — se vencer de novo, sua vaga extra vai pro ranking (definido só depois da última classificatória).
          </p>
        </div>
      </section>
    );
  }
  return (
    <section className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <Target className="mt-0.5 h-6 w-6 shrink-0 text-pink-300" strokeWidth={2} />
      <div>
        <p className="font-bold text-white">Ainda não classificado(a)</p>
        <p className="mt-0.5 text-sm leading-relaxed text-white/65">
          Vença uma classificatória pra garantir sua vaga.
          {queueIndex >= 0 && ` Pelo ranking, você é o Nº ${queueIndex + 1} da fila${isSetter ? " (com prioridade de levantador)" : ""}.`}
        </p>
      </div>
    </section>
  );
}

async function OrganizerPanel({
  cup,
  qualifiedIds,
  capacity,
  missingFromFinal,
}: {
  cup: Cup;
  qualifiedIds: Set<string>;
  capacity: number;
  missingFromFinal: number;
}) {
  const supabase = await createClient();
  const windowStart = new Date();
  windowStart.setUTCDate(windowStart.getUTCDate() - 60);
  const [{ data: events }, { data: linked }, { data: players }] = await Promise.all([
    supabase
      .from("events")
      .select("id, date, time, is_mini_torneio, is_pre_torneio")
      .eq("community", cup.community)
      .neq("status", "cancelled")
      .gte("date", windowStart.toISOString().slice(0, 10))
      .order("date", { ascending: true }),
    supabase.from("cup_qualifiers").select("event_id"),
    supabase.from("profiles").select("id, full_name").eq("status", "approved").contains("communities", [cup.community]).order("full_name"),
  ]);
  const linkedIds = new Set((linked ?? []).map((row) => row.event_id));
  const qualifierOptions = (events ?? []).filter((event) => !linkedIds.has(event.id) && event.id !== cup.final_event_id && (!cup.final_date || event.date < cup.final_date));
  const finalOptions = (events ?? []).filter((event) => !linkedIds.has(event.id));
  const playerOptions = (players ?? []).filter((player) => !qualifiedIds.has(player.id));
  const eventLabel = (event: { date: string; time: string | null; is_mini_torneio: boolean; is_pre_torneio: boolean }) =>
    `${new Date(`${event.date}T00:00:00`).toLocaleDateString("pt-BR")}${event.time ? ` ${formatTime(event.time)}` : ""}${event.is_mini_torneio ? " · mini torneio" : event.is_pre_torneio ? " · pré-torneio" : ""}`;

  const buttonClass = "inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-brand-navy px-4 text-sm font-semibold text-white hover:bg-brand-navy-light";

  return (
    <section className="space-y-4 rounded-2xl border border-red-300/20 bg-red-500/[0.04] p-4 sm:p-5">
      <div>
        <h2 className="text-base font-bold text-white">Painel da organização</h2>
        <p className="mt-0.5 text-xs leading-relaxed text-white/55">
          Rachas criados nas datas da copa entram sozinhos como classificatória ou final. Use os controles abaixo para ajustes.
          A classificatória precisa ser mini torneio ou pré-torneio, pra ter final.
        </p>
      </div>

      <ActionForm action={setCupFinalDate} successMessage="Data da final atualizada." className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <input type="hidden" name="cupId" value={cup.id} />
        <label className="block min-w-0 flex-1 text-xs font-medium text-white/60">
          Data da final <span className="text-white/30">(em branco = a definir)</span>
          <input
            type="date"
            name="finalDate"
            defaultValue={cup.final_date ?? ""}
            className="mt-1.5 min-h-10 w-full rounded-xl border border-white/15 bg-white/[0.03] px-3 text-sm text-white"
          />
        </label>
        <button type="submit" className={buttonClass}>Salvar data</button>
      </ActionForm>

      <ActionForm action={setCupFinalEvent} successMessage="Final atualizada." className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <input type="hidden" name="cupId" value={cup.id} />
        <div className="min-w-0 flex-1">
          <FormSelect id="copa-final" name="eventId" label="Racha da final" defaultValue={cup.final_event_id ?? ""}>
            <option value="">Nenhum (ainda não criado)</option>
            {finalOptions.map((event) => (
              <option key={event.id} value={event.id}>{eventLabel(event)}</option>
            ))}
          </FormSelect>
        </div>
        <button type="submit" className={buttonClass}>Salvar final</button>
      </ActionForm>

      {cup.final_event_id && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 px-3 py-2.5">
          <p className="min-w-0 flex-1 text-sm text-white/70">
            {missingFromFinal ? `${missingFromFinal} classificado(s) ainda fora da lista da final.` : "Todos os classificados estão na lista da final."}
          </p>
          <ConfirmActionButton
            action={syncCupFinal}
            fields={{ cupId: cup.id }}
            successMessage="Lista da final sincronizada."
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-white/15 px-3 text-xs font-semibold text-white hover:bg-white/5"
          >
            <RefreshCw className="h-3.5 w-3.5" strokeWidth={2.25} /> Colocar na lista
          </ConfirmActionButton>
        </div>
      )}

      <ActionForm action={addCupQualifier} successMessage="Classificatória adicionada!" className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <input type="hidden" name="cupId" value={cup.id} />
        <div className="min-w-0 flex-1">
          <FormSelect id="copa-qualifier" name="eventId" label="Adicionar racha classificatório" defaultValue="" required>
            <option value="" disabled>Escolher racha...</option>
            {qualifierOptions.map((event) => (
              <option key={event.id} value={event.id}>{eventLabel(event)}</option>
            ))}
          </FormSelect>
        </div>
        <button type="submit" className={buttonClass}>Adicionar</button>
      </ActionForm>

      <ActionForm action={addCupPlayer} successMessage="Classificado(a) pela organização!" className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <input type="hidden" name="cupId" value={cup.id} />
        <div className="min-w-0 flex-1">
          <FormSelect id="copa-player" name="profileId" label="Classificar alguém direto" defaultValue="" required>
            <option value="" disabled>Escolher jogador...</option>
            {playerOptions.map((player) => (
              <option key={player.id} value={player.id}>{player.full_name}</option>
            ))}
          </FormSelect>
        </div>
        <button type="submit" className={buttonClass}>
          <UserPlus className="h-4 w-4" strokeWidth={2} /> Classificar
        </button>
      </ActionForm>

      {qualifiedIds.size < capacity && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-400/5 px-3 py-2.5">
          <p className="min-w-0 flex-1 text-sm text-cyan-50/80">Alguém desistiu? Preencha a vaga com o 1º da fila do ranking.</p>
          <ConfirmActionButton
            action={fillCupSpotFromRanking}
            fields={{ cupId: cup.id }}
            confirmMessage="Classificar o 1º da fila do ranking?"
            successMessage="Vaga preenchida pelo ranking."
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-cyan-500 px-3 text-xs font-bold text-cyan-950 hover:bg-cyan-400"
          >
            Puxar do ranking
          </ConfirmActionButton>
        </div>
      )}

      <details className="rounded-xl border border-white/10 px-3 py-2.5">
        <summary className="cursor-pointer text-sm font-semibold text-white/80">Criar uma nova copa</summary>
        <div className="mt-3">
          <CreateCupForm embedded />
        </div>
      </details>
    </section>
  );
}

function CreateCupForm({ embedded = false }: { embedded?: boolean }) {
  return (
    <ActionForm
      action={createCup}
      successMessage="Copa criada!"
      className={`grid gap-3 sm:grid-cols-2 ${embedded ? "" : "rounded-2xl border border-white/10 p-4"}`}
    >
      <label className="block text-xs font-medium text-white/60">
        Nome
        <input name="name" defaultValue="Copa VPA" maxLength={80} className="mt-1.5 min-h-10 w-full rounded-xl border border-white/15 bg-white/[0.03] px-3 text-sm text-white" />
      </label>
      <label className="block text-xs font-medium text-white/60">
        Data da final <span className="text-white/30">(opcional)</span>
        <input type="date" name="finalDate" className="mt-1.5 min-h-10 w-full rounded-xl border border-white/15 bg-white/[0.03] px-3 text-sm text-white" />
      </label>
      <label className="block text-xs font-medium text-white/60 sm:col-span-2">
        Datas das classificatórias (ex.: 01/11, 08/11, 15/11, 22/11)
        <input name="qualifierDates" placeholder="01/11, 08/11, 15/11, 22/11" className="mt-1.5 min-h-10 w-full rounded-xl border border-white/15 bg-white/[0.03] px-3 text-sm text-white" />
      </label>
      <label className="block text-xs font-medium text-white/60">
        Times na final
        <input type="number" name="numTeams" defaultValue={4} min={2} max={8} className="mt-1.5 min-h-10 w-full rounded-xl border border-white/15 bg-white/[0.03] px-3 text-sm text-white" />
      </label>
      <label className="block text-xs font-medium text-white/60">
        Jogadores por time
        <input type="number" name="teamSize" defaultValue={6} min={2} max={12} className="mt-1.5 min-h-10 w-full rounded-xl border border-white/15 bg-white/[0.03] px-3 text-sm text-white" />
      </label>
      <button type="submit" className="min-h-10 rounded-xl bg-brand-purple px-4 text-sm font-bold text-white hover:bg-brand-purple-dark sm:col-span-2">
        Criar copa
      </button>
    </ActionForm>
  );
}
