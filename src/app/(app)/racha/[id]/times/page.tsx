import { notFound } from "next/navigation";
import { Trophy, Undo2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { getRatingsFor, getRatingWeights } from "@/lib/ratings";
import { finalScoresForPlayer, overallScore } from "@/lib/scoring";
import { PlayerActionSelect } from "@/components/PlayerActionSelect";
import { AddToTeamSelect } from "@/components/AddToTeamSelect";
import { SetterBadge } from "@/components/SetterBadge";
import { Avatar } from "@/components/Avatar";
import { MatchWinButton } from "@/components/MatchWinButton";
import { ExportTeamsButton } from "@/components/ExportTeamsButton";
import { ActionForm } from "@/components/ActionForm";
import {
  generateTeams,
  addToTeam,
  moveMember,
  swapMembers,
  replaceMember,
  removeFromTeam,
  recordMatchWin,
  undoLastMatchWin,
} from "./actions";

export default async function TimesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireProfile();
  const supabase = await createClient();

  const [{ data: event }, { data: generation }, { data: confirmedAttendance }] = await Promise.all([
    supabase.from("events").select("id, date, num_teams, official_list_open").eq("id", id).maybeSingle(),
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
  ]);
  if (!event) notFound();

  let teams: {
    id: string;
    teamNumber: number;
    wins: number;
    members: {
      teamMemberId: string;
      profileId: string;
      fullName: string;
      avatarUrl: string | null;
      overall: number;
      isSetter: boolean;
    }[];
  }[] = [];

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
      supabase.from("match_wins").select("team_id").eq("event_id", id),
    ]);

    const winsByTeam = new Map<string, number>();
    for (const w of winRows ?? []) {
      winsByTeam.set(w.team_id, (winsByTeam.get(w.team_id) ?? 0) + 1);
    }

    teams = (teamRows ?? []).map((t) => ({
      id: t.id,
      teamNumber: t.team_number,
      wins: winsByTeam.get(t.id) ?? 0,
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
            isSetter: p?.is_setter ?? false,
          };
        }),
    }));
  }

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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Times</h1>
          <p className="mt-1 text-sm text-white/60">
            Racha de {eventDateLabel} · {event.num_teams} times
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {generation && (
            <ExportTeamsButton
              eventDateLabel={eventDateLabel}
              teams={teams.map((t) => ({ teamNumber: t.teamNumber, members: t.members }))}
            />
          )}
          {profile.is_organizer && event.official_list_open && (
            <ActionForm
              action={generateTeams}
              successMessage={generation ? "Times gerados novamente!" : "Times gerados com sucesso!"}
            >
              <input type="hidden" name="eventId" value={id} />
              <button className="rounded-lg bg-brand-purple px-4 py-2 text-sm font-medium text-white hover:bg-brand-purple-dark">
                {generation ? "Gerar novamente" : "Gerar times"}
              </button>
            </ActionForm>
          )}
        </div>
      </div>

      {generation && profile.is_organizer && orphanedMembers.length > 0 && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/15 px-4 py-3 text-sm text-red-300">
          {orphanedMembers.map((p) => `${p.fullName} (Time ${p.teamNumber})`).join(", ")}{" "}
          {orphanedMembers.length === 1 ? "não está mais confirmado(a)" : "não estão mais confirmados(as)"} mas ainda{" "}
          {orphanedMembers.length === 1 ? "está" : "estão"} no time — use &ldquo;Substituir por&rdquo; (se já tiver
          alguém pra entrar no lugar) ou &ldquo;Remover do time&rdquo;.
        </p>
      )}

      {generation && profile.is_organizer && unassignedConfirmed.length > 0 && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/15 px-4 py-3 text-sm text-amber-300">
          {unassignedConfirmed.map((p) => p.fullName).join(", ")}{" "}
          {unassignedConfirmed.length === 1 ? "está confirmado(a)" : "estão confirmados(as)"} mas ainda{" "}
          {unassignedConfirmed.length === 1 ? "não foi colocado(a)" : "não foram colocados(as)"} em nenhum time — use
          &ldquo;Substituir por&rdquo; no lugar de quem saiu.
        </p>
      )}

      {!generation && !event.official_list_open && (
        <p className="text-sm text-white/60">
          Os times só podem ser gerados depois que a lista oficial do racha abrir.
        </p>
      )}

      {!generation && event.official_list_open && (
        <p className="text-sm text-white/60">
          Os times ainda não foram gerados. {profile.is_organizer ? "Clique em \"Gerar times\" acima." : "Aguarde o organizador gerar."}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {teams.map((team) => {
          const sum = team.members.reduce((s, m) => s + m.overall, 0);
          return (
            <div key={team.id} className="rounded-xl border border-white/10 p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-white">Time {team.teamNumber}</h3>
                <span className="text-xs text-white/40">soma: {sum.toFixed(1)}</span>
              </div>

              <div className="mt-2 flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2">
                <Trophy className="h-4 w-4 shrink-0 text-purple-300" strokeWidth={2} />
                <span className="text-sm font-medium text-white">
                  {team.wins} {team.wins === 1 ? "vitória" : "vitórias"}
                </span>
                {profile.is_organizer && (
                  <div className="ml-auto flex items-center gap-1.5">
                    {team.wins > 0 && (
                      <ActionForm action={undoLastMatchWin} successMessage="Vitória desfeita.">
                        <input type="hidden" name="eventId" value={id} />
                        <input type="hidden" name="teamId" value={team.id} />
                        <button
                          type="submit"
                          aria-label="Desfazer última vitória"
                          className="flex h-7 w-7 items-center justify-center rounded-full text-white/40 hover:bg-white/10 hover:text-white/70"
                        >
                          <Undo2 className="h-3.5 w-3.5" strokeWidth={2} />
                        </button>
                      </ActionForm>
                    )}
                    <MatchWinButton
                      action={recordMatchWin}
                      eventId={id}
                      teamId={team.id}
                      teamNumber={team.teamNumber}
                    />
                  </div>
                )}
              </div>

              <ul className="mt-3 space-y-2.5">
                {team.members.map((m) => (
                  <li key={m.teamMemberId} className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex min-w-0 items-center gap-2 text-white">
                      <Avatar src={m.avatarUrl} name={m.fullName} size="sm" />
                      <span className="min-w-0 truncate">{m.fullName}</span>
                      {m.isSetter && <SetterBadge />}
                      {orphanedTeamMemberIds.has(m.teamMemberId) && (
                        <span className="inline-flex shrink-0 items-center rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold text-red-300">
                          não confirmado(a)
                        </span>
                      )}
                    </span>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span className="text-xs text-white/40">{m.overall.toFixed(1)}</span>
                      {profile.is_organizer && (
                        <PlayerActionSelect
                          moveAction={moveMember}
                          swapAction={swapMembers}
                          replaceAction={replaceMember}
                          removeAction={removeFromTeam}
                          eventId={id}
                          teamMemberId={m.teamMemberId}
                          currentTeamId={team.id}
                          fullName={m.fullName}
                          teams={teams.map((t) => ({ id: t.id, teamNumber: t.teamNumber }))}
                          otherMembers={allMembersFlat.filter((x) => x.teamMemberId !== m.teamMemberId)}
                          unassignedConfirmed={unassignedConfirmed}
                        />
                      )}
                    </div>
                  </li>
                ))}
              </ul>

              {profile.is_organizer && unassignedConfirmed.length > 0 && (
                <div className="mt-3">
                  <AddToTeamSelect
                    action={addToTeam}
                    eventId={id}
                    teamId={team.id}
                    players={unassignedConfirmed}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
