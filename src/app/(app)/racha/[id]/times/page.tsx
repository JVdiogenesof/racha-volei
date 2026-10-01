import Link from "next/link";
import { notFound } from "next/navigation";
import { RefreshCw, Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { getRatingsFor, getRatingWeights } from "@/lib/ratings";
import { finalScoresForPlayer, overallScore } from "@/lib/scoring";
import { computeStandings } from "@/lib/torneioStandings";
import { PlayerActionSelect } from "@/components/PlayerActionSelect";
import { AddToTeamSelect } from "@/components/AddToTeamSelect";
import { SetterBadge } from "@/components/SetterBadge";
import { Avatar } from "@/components/Avatar";
import { NormalMatchRecorder } from "@/components/NormalMatchRecorder";
import { ExportTeamsButton } from "@/components/ExportTeamsButton";
import { ShareTeamsArtButton } from "@/components/ShareTeamsArtButton";
import { TournamentMatchScoreForm } from "@/components/TournamentMatchScoreForm";
import { ResetGroupStageButton } from "@/components/ResetGroupStageButton";
import { UndoFinalButton } from "@/components/UndoFinalButton";
import { SimulateTeamsButton } from "@/components/SimulateTeamsButton";
import { ActionForm } from "@/components/ActionForm";
import { VictoryTeamCard } from "@/components/VictoryTeamCard";
import { TeamsWorkspaceTabs } from "@/components/TeamsWorkspaceTabs";
import { teamFormatLabel } from "@/lib/rachaFormat";
import { getActiveCommunity } from "@/lib/community";
import {
  generateTeams,
  addToTeam,
  moveMember,
  swapMembers,
  replaceMember,
  removeFromTeam,
  recordNormalMatch,
  undoNormalMatch,
  recordTournamentMatchScore,
  resetGroupStage,
  undoFinal,
  simulateTeams,
} from "./actions";

export default async function TimesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireProfile();
  const supabase = await createClient();
  const community = await getActiveCommunity(profile);

  const [{ data: event }, { data: generation }, { data: confirmedAttendance }, { data: setterOverrideRows }] = await Promise.all([
    supabase
      .from("events")
      .select("id, date, num_teams, team_size, official_list_open, is_pre_torneio, community, status")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("team_generations")
      .select("id, generated_at")
      .eq("event_id", id)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("attendance")
      .select("profile_id, profiles(full_name)")
      .eq("event_id", id)
      .eq("status", "confirmed"),
    supabase.from("event_setter_overrides").select("profile_id, is_setter").eq("event_id", id),
  ]);
  if (!event) notFound();
  if (event.community !== community) notFound();
  const canManage = profile.is_organizer && event.status !== "cancelled";
  const canRegenerate = canManage && event.status !== "finished";
  const setterOverrides = new Map((setterOverrideRows ?? []).map((row) => [row.profile_id, row.is_setter]));

  let teams: {
    id: string;
    teamNumber: number;
    wins: number;
    losses: number;
    members: {
      teamMemberId: string;
      profileId: string;
      fullName: string;
      avatarUrl: string | null;
      overall: number;
      isSetter: boolean;
    }[];
  }[] = [];

  type MatchLite = { id: string; teamAId: string; teamBId: string; scoreA: number | null; scoreB: number | null };
  let groupMatches: MatchLite[] = [];
  let finalMatch: MatchLite | null = null;
  let thirdPlaceMatch: MatchLite | null = null;
  let standings: ReturnType<typeof computeStandings> = [];
  let normalConfrontations: { id: string; winnerTeamId: string; loserTeamId: string }[] = [];

  if (generation) {
    const { data: teamRows } = await supabase
      .from("teams")
      .select("id, team_number")
      .eq("generation_id", generation.id)
      .order("team_number");

    const teamIds = (teamRows ?? []).map((t) => t.id);

    const { data: memberRows } = await supabase
      .from("team_members")
      .select("id, team_id, profile_id, profiles(full_name, avatar_url, is_setter)")
      .in("team_id", teamIds);
    const memberProfileIds = (memberRows ?? []).map((m) => m.profile_id);

    const [{ selfByProfile, organizerByProfile }, weights, { data: winRows }] = await Promise.all([
      getRatingsFor(supabase, memberProfileIds),
      getRatingWeights(supabase),
      supabase
        .from("match_wins")
        .select("id, team_id, loser_team_id, recorded_at")
        .eq("event_id", id)
        .order("recorded_at", { ascending: false }),
    ]);

    const winsByTeam = new Map<string, number>();
    const lossesByTeam = new Map<string, number>();
    for (const w of winRows ?? []) {
      winsByTeam.set(w.team_id, (winsByTeam.get(w.team_id) ?? 0) + 1);
      if (w.loser_team_id) lossesByTeam.set(w.loser_team_id, (lossesByTeam.get(w.loser_team_id) ?? 0) + 1);
    }

    if (!event.is_pre_torneio) {
      normalConfrontations = (winRows ?? [])
        .filter((win): win is typeof win & { loser_team_id: string } => Boolean(win.loser_team_id))
        .map((win) => ({ id: win.id, winnerTeamId: win.team_id, loserTeamId: win.loser_team_id }));
    }

    teams = (teamRows ?? []).map((t) => ({
      id: t.id,
      teamNumber: t.team_number,
      wins: winsByTeam.get(t.id) ?? 0,
      losses: lossesByTeam.get(t.id) ?? 0,
      members: (memberRows ?? [])
        .filter((m) => m.team_id === t.id)
        .map((m) => {
          const p = m.profiles as unknown as { full_name: string; avatar_url: string | null; is_setter: boolean } | null;
          const scores = finalScoresForPlayer(
            selfByProfile.get(m.profile_id) ?? {},
            organizerByProfile.get(m.profile_id) ?? {},
            weights.selfWeight,
            weights.organizerWeight,
          );
          return {
            teamMemberId: m.id,
            profileId: m.profile_id,
            fullName: p?.full_name ?? "—",
            avatarUrl: p?.avatar_url ?? null,
            overall: overallScore(scores),
            isSetter: setterOverrides.get(m.profile_id) ?? p?.is_setter ?? false,
          };
        }),
    }));

    if (event.is_pre_torneio) {
      const { data: matchRows } = await supabase
        .from("tournament_matches")
        .select("id, stage, team_a_id, team_b_id, score_a, score_b")
        .eq("event_id", id);

      const toMatch = (m: NonNullable<typeof matchRows>[number]) => ({
        id: m.id,
        teamAId: m.team_a_id,
        teamBId: m.team_b_id,
        scoreA: m.score_a,
        scoreB: m.score_b,
      });
      groupMatches = (matchRows ?? []).filter((m) => m.stage === "group").map(toMatch);
      finalMatch = (matchRows ?? []).filter((m) => m.stage === "final").map(toMatch)[0] ?? null;
      thirdPlaceMatch = (matchRows ?? []).filter((m) => m.stage === "third_place").map(toMatch)[0] ?? null;

      standings = computeStandings(
        teams.map((t) => ({ id: t.id, teamNumber: t.teamNumber })),
        groupMatches,
      );
    }
  }

  const teamLabelById = new Map(teams.map((t) => [t.id, `Time ${t.teamNumber}`]));

  const eventDateLabel = new Date(`${event.date}T00:00:00`).toLocaleDateString("pt-BR");
  const allMembersFlat = teams.flatMap((t) =>
    t.members.map((m) => ({ teamMemberId: m.teamMemberId, fullName: m.fullName, teamNumber: t.teamNumber })),
  );

  // Gente confirmada que entrou depois da geração dos times (ex: substituiu
  // alguém que saiu) e por isso ainda não tem uma linha em team_members.
  const assignedProfileIds = new Set(teams.flatMap((t) => t.members.map((m) => m.profileId)));
  const unassignedConfirmed = (confirmedAttendance ?? [])
    .filter((a) => !assignedProfileIds.has(a.profile_id))
    .map((a) => ({
      profileId: a.profile_id,
      fullName: (a.profiles as unknown as { full_name: string } | null)?.full_name ?? "?",
    }));

  // O caminho inverso: gente que já saiu da lista de confirmados mas ainda
  // está presa num time (a geração de times não se atualiza sozinha quando
  // alguém sai depois de gerada).
  const confirmedProfileIds = new Set((confirmedAttendance ?? []).map((a) => a.profile_id));
  const orphanedTeamMemberIds = new Set(
    teams.flatMap((t) => t.members.filter((m) => !confirmedProfileIds.has(m.profileId)).map((m) => m.teamMemberId)),
  );
  const orphanedMembers = teams.flatMap((t) =>
    t.members
      .filter((m) => !confirmedProfileIds.has(m.profileId))
      .map((m) => ({ fullName: m.fullName, teamNumber: t.teamNumber })),
  );

  const tournamentMatchCount = groupMatches.length + (finalMatch ? 1 : 0) + (thirdPlaceMatch ? 1 : 0);
  const tournamentPlayedCount = [...groupMatches, finalMatch, thirdPlaceMatch].filter(
    (match) => match?.scoreA != null && match?.scoreB != null,
  ).length;
  const showActionDock = Boolean(generation) || canManage;

  return (
    <div className={`space-y-4 ${showActionDock ? "pb-40" : ""}`}>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold text-white">Times e confrontos</h1>
          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold text-white/60">{eventDateLabel}</span>
          {event.is_pre_torneio && <span className="rounded-full border border-amber-300/20 bg-amber-400/10 px-2.5 py-1 text-xs font-bold text-amber-200">PRÉ-TORNEIO</span>}
        </div>
        <p className="mt-1.5 text-sm text-white/50">{event.num_teams} times · {teamFormatLabel(event.team_size)}</p>
      </div>

      {showActionDock && (
        <div className="fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom))] left-1/2 z-40 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-white/15 bg-[#171122]/95 p-1.5 shadow-2xl shadow-black/60 backdrop-blur-xl">
          {canRegenerate && <SimulateTeamsButton eventId={id} action={simulateTeams} compact />}
          {generation && (
            <>
              <ShareTeamsArtButton eventId={id} eventDate={event.date} compact />
              <ExportTeamsButton eventDateLabel={eventDateLabel} teams={teams.map((team) => ({ teamNumber: team.teamNumber, members: team.members }))} compact />
            </>
          )}
          {finalMatch?.scoreA != null && finalMatch.scoreB != null && (
            <Link href={`/racha/${id}/resultado`} aria-label="Ver resultado final" title="Ver resultado final" className="flex h-11 w-11 items-center justify-center rounded-full border border-amber-300/30 bg-amber-400/10 text-amber-300 hover:bg-amber-400/20">
              <Trophy className="h-5 w-5" />
            </Link>
          )}
          {canRegenerate && event.official_list_open && (
            <ActionForm action={generateTeams} successMessage={generation ? "Times gerados novamente!" : "Times gerados com sucesso!"}>
              <input type="hidden" name="eventId" value={id} />
              <button type="submit" aria-label={generation ? "Gerar times novamente" : "Gerar times"} title={generation ? "Gerar times novamente" : "Gerar times"} className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-purple text-white hover:bg-brand-purple-dark">
                <RefreshCw className="h-5 w-5" />
              </button>
            </ActionForm>
          )}
        </div>
      )}

      {generation && canManage && orphanedMembers.length > 0 && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/15 px-4 py-3 text-sm text-red-300">
          {orphanedMembers.map((p) => `${p.fullName} (Time ${p.teamNumber})`).join(", ")}{" "}
          {orphanedMembers.length === 1 ? "não está mais confirmado(a)" : "não estão mais confirmados(as)"} mas ainda{" "}
          {orphanedMembers.length === 1 ? "está" : "estão"} no time — use &ldquo;Substituir por&rdquo; (se já tiver
          alguém pra entrar no lugar) ou &ldquo;Remover do time&rdquo;.
        </p>
      )}

      {generation && canManage && unassignedConfirmed.length > 0 && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/15 px-4 py-3 text-sm text-amber-300">
          {unassignedConfirmed.map((p) => p.fullName).join(", ")}{" "}
          {unassignedConfirmed.length === 1 ? "está confirmado(a)" : "estão confirmados(as)"} mas ainda{" "}
          {unassignedConfirmed.length === 1 ? "não foi colocado(a)" : "não foram colocados(as)"} em nenhum time — use
          &ldquo;Substituir por&rdquo; no lugar de quem saiu.
        </p>
      )}

      {!generation && !event.official_list_open && (
        <p className="text-sm text-white/60">
          Os times oficiais só podem ser gerados depois que a lista oficial do racha abrir
          {canManage ? " — mas dá para usar o botão de simulação na ilha inferior." : "."}
        </p>
      )}

      {!generation && event.official_list_open && (
        <p className="text-sm text-white/60">
          Os times ainda não foram gerados. {canManage ? "Use o botão roxo de gerar times na ilha inferior." : "Aguarde o organizador gerar."}
        </p>
      )}

      {generation && (
        <TeamsWorkspaceTabs
          teamCount={teams.length}
          matchCount={event.is_pre_torneio ? tournamentMatchCount : normalConfrontations.length}
          standingCount={event.is_pre_torneio ? standings.length : 0}
          teamsContent={
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {teams.map((team) => {
                const sum = team.members.reduce((total, member) => total + member.overall, 0);
                return (
                  <VictoryTeamCard key={team.id} teamId={team.id}>
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-semibold text-white">Time {team.teamNumber}</h3>
                      <div className="flex items-center gap-2">
                        {!event.is_pre_torneio && <span className="rounded-full bg-purple-400/10 px-2 py-1 text-[11px] font-bold text-purple-200">{team.wins}V · {team.losses}D</span>}
                        <span className="text-[11px] text-white/35">{sum.toFixed(1)}</span>
                      </div>
                    </div>

                    <ul className="mt-2.5 divide-y divide-white/8">
                      {team.members.map((member) => (
                        <li key={member.teamMemberId} className="flex min-w-0 items-center gap-2 py-2 first:pt-0 last:pb-0">
                          <Avatar src={member.avatarUrl} name={member.fullName} size="sm" />
                          <span className="min-w-0 flex-1 truncate text-sm text-white">{member.fullName}</span>
                          {member.isSetter && <SetterBadge />}
                          {orphanedTeamMemberIds.has(member.teamMemberId) && <span title="Não está mais confirmado(a)" className="h-2 w-2 shrink-0 rounded-full bg-red-400" />}
                          <span className="shrink-0 text-xs text-white/35">{member.overall.toFixed(1)}</span>
                          {canManage && (
                            <PlayerActionSelect
                              moveAction={moveMember}
                              swapAction={swapMembers}
                              replaceAction={replaceMember}
                              removeAction={removeFromTeam}
                              eventId={id}
                              teamMemberId={member.teamMemberId}
                              currentTeamId={team.id}
                              fullName={member.fullName}
                              teams={teams.map((item) => ({ id: item.id, teamNumber: item.teamNumber }))}
                              otherMembers={allMembersFlat.filter((item) => item.teamMemberId !== member.teamMemberId)}
                              unassignedConfirmed={unassignedConfirmed}
                              compact
                            />
                          )}
                        </li>
                      ))}
                    </ul>

                    {canManage && unassignedConfirmed.length > 0 && (
                      <div className="mt-3 border-t border-white/8 pt-3">
                        <AddToTeamSelect action={addToTeam} eventId={id} teamId={team.id} players={unassignedConfirmed} />
                      </div>
                    )}
                  </VictoryTeamCard>
                );
              })}
            </div>
          }
          matchesContent={
            event.is_pre_torneio ? (
              <div className="space-y-3">
                <section className="rounded-xl border border-white/10 bg-white/[0.02] p-3.5 sm:p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h2 className="font-semibold text-white">Fase de grupos</h2>
                      <p className="text-xs text-white/40">{groupMatches.filter((match) => match.scoreA != null && match.scoreB != null).length} de {groupMatches.length} partidas concluídas</p>
                    </div>
                    {canManage && <ResetGroupStageButton eventId={id} action={resetGroupStage} />}
                  </div>
                  <div className="mt-3 grid gap-2 lg:grid-cols-2">
                    {groupMatches.map((match, index) => (
                      canManage ? (
                        <TournamentMatchScoreForm key={match.id} action={recordTournamentMatchScore} eventId={id} matchId={match.id} teamALabel={teamLabelById.get(match.teamAId) ?? "?"} teamBLabel={teamLabelById.get(match.teamBId) ?? "?"} scoreA={match.scoreA} scoreB={match.scoreB} />
                      ) : (
                        <article key={match.id} className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-white/35">Jogo {index + 1}</p>
                          <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-center text-sm font-semibold text-white">
                            <span>{teamLabelById.get(match.teamAId) ?? "?"}</span>
                            <span className="rounded-lg bg-white/5 px-2 py-1 text-base">{match.scoreA ?? "–"} × {match.scoreB ?? "–"}</span>
                            <span>{teamLabelById.get(match.teamBId) ?? "?"}</span>
                          </div>
                        </article>
                      )
                    ))}
                  </div>
                </section>

                {finalMatch && (
                  <section className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 sm:p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h2 className="flex items-center gap-1.5 font-semibold text-white"><Trophy className="h-4 w-4 text-amber-400" /> Final</h2>
                      {canManage && <UndoFinalButton eventId={id} action={undoFinal} />}
                    </div>
                    {finalMatch.scoreA != null && finalMatch.scoreB != null && <p className="mt-2 text-sm font-medium text-amber-200">🏆 {finalMatch.scoreA > finalMatch.scoreB ? teamLabelById.get(finalMatch.teamAId) : teamLabelById.get(finalMatch.teamBId)} é campeão e garante vaga no Torneio VPA!</p>}
                    <div className="mt-3">
                      {canManage ? (
                        <TournamentMatchScoreForm action={recordTournamentMatchScore} eventId={id} matchId={finalMatch.id} teamALabel={teamLabelById.get(finalMatch.teamAId) ?? "?"} teamBLabel={teamLabelById.get(finalMatch.teamBId) ?? "?"} scoreA={finalMatch.scoreA} scoreB={finalMatch.scoreB} />
                      ) : (
                        <p className="rounded-xl border border-white/10 bg-black/10 px-3 py-3 text-center font-semibold text-white">{teamLabelById.get(finalMatch.teamAId) ?? "?"} <span className="mx-2 text-amber-200">{finalMatch.scoreA ?? "–"} × {finalMatch.scoreB ?? "–"}</span> {teamLabelById.get(finalMatch.teamBId) ?? "?"}</p>
                      )}
                    </div>
                  </section>
                )}

                {thirdPlaceMatch && (
                  <section className="rounded-xl border border-white/10 p-3.5 sm:p-4">
                    <h2 className="font-semibold text-white">Disputa de 3º lugar</h2>
                    <p className="text-xs text-white/40">Partida opcional</p>
                    {thirdPlaceMatch.scoreA != null && thirdPlaceMatch.scoreB != null && (
                      <p className="mt-2 text-sm text-white/70">🥉 {thirdPlaceMatch.scoreA > thirdPlaceMatch.scoreB ? teamLabelById.get(thirdPlaceMatch.teamAId) : teamLabelById.get(thirdPlaceMatch.teamBId)} ficou em 3º lugar.</p>
                    )}
                    <div className="mt-3">
                      {canManage ? (
                        <TournamentMatchScoreForm action={recordTournamentMatchScore} eventId={id} matchId={thirdPlaceMatch.id} teamALabel={teamLabelById.get(thirdPlaceMatch.teamAId) ?? "?"} teamBLabel={teamLabelById.get(thirdPlaceMatch.teamBId) ?? "?"} scoreA={thirdPlaceMatch.scoreA} scoreB={thirdPlaceMatch.scoreB} />
                      ) : (
                        <p className="rounded-xl bg-white/[0.025] px-3 py-3 text-center font-semibold text-white">{teamLabelById.get(thirdPlaceMatch.teamAId) ?? "?"} <span className="mx-2 text-white/60">{thirdPlaceMatch.scoreA ?? "–"} × {thirdPlaceMatch.scoreB ?? "–"}</span> {teamLabelById.get(thirdPlaceMatch.teamBId) ?? "?"}</p>
                      )}
                    </div>
                  </section>
                )}
              </div>
            ) : (
              <NormalMatchRecorder eventId={id} teams={teams.map((team) => ({ id: team.id, teamNumber: team.teamNumber }))} confrontations={normalConfrontations} isOrganizer={canManage} recordAction={recordNormalMatch} undoAction={undoNormalMatch} />
            )
          }
          standingsContent={
            event.is_pre_torneio ? (
              <section className="rounded-xl border border-white/10 bg-white/[0.02] p-3.5 sm:p-4">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-white">Classificação</h2>
                    <p className="text-xs text-white/40">Os dois primeiros avançam para a final.</p>
                  </div>
                  <span className="text-xs text-white/35">{tournamentPlayedCount} jogos</span>
                </div>
                <ol className="mt-3 space-y-2">
                  {standings.map((standing, index) => (
                    <li key={standing.teamId} className={`grid grid-cols-[auto_minmax(0,1fr)_repeat(3,auto)] items-center gap-3 rounded-xl border px-3 py-3 ${index < 2 ? "border-amber-300/20 bg-amber-400/[0.06]" : "border-white/10 bg-white/[0.025]"}`}>
                      <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-black ${index < 2 ? "bg-amber-400/15 text-amber-200" : "bg-white/5 text-white/45"}`}>{index + 1}</span>
                      <div className="min-w-0"><p className="truncate text-sm font-semibold text-white">Time {standing.teamNumber}</p>{index < 2 && <p className="text-[10px] font-bold text-amber-200/70">CLASSIFICADO</p>}</div>
                      <Stat label="V" value={standing.wins} />
                      <Stat label="Saldo" value={`${standing.balance > 0 ? "+" : ""}${standing.balance}`} />
                      <Stat label="Pontos" value={standing.pointsFor} />
                    </li>
                  ))}
                </ol>
              </section>
            ) : undefined
          }
        />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <span className="text-center">
      <span className="block text-[9px] font-bold uppercase tracking-wide text-white/30">{label}</span>
      <span className="block text-sm font-bold text-white/80">{value}</span>
    </span>
  );
}
