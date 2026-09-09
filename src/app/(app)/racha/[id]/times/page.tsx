import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { getAllRatings, getRatingWeights } from "@/lib/ratings";
import { finalScoresForPlayer, overallScore } from "@/lib/scoring";
import { MoveTeamSelect } from "@/components/MoveTeamSelect";
import { ActionForm } from "@/components/ActionForm";
import { generateTeams, moveMember } from "./actions";

export default async function TimesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: event } = await supabase
    .from("events")
    .select("id, date, num_teams")
    .eq("id", id)
    .maybeSingle();
  if (!event) notFound();

  const { data: generation } = await supabase
    .from("team_generations")
    .select("id, generated_at")
    .eq("event_id", id)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let teams: {
    id: string;
    teamNumber: number;
    members: { teamMemberId: string; profileId: string; fullName: string; overall: number; isSetter: boolean }[];
  }[] = [];

  if (generation) {
    const { data: teamRows } = await supabase
      .from("teams")
      .select("id, team_number")
      .eq("generation_id", generation.id)
      .order("team_number");

    const { data: memberRows } = await supabase
      .from("team_members")
      .select("id, team_id, profile_id, profiles(full_name, is_setter)")
      .in("team_id", (teamRows ?? []).map((t) => t.id));

    const { selfByProfile, organizerByProfile } = await getAllRatings(supabase);
    const weights = await getRatingWeights(supabase);

    teams = (teamRows ?? []).map((t) => ({
      id: t.id,
      teamNumber: t.team_number,
      members: (memberRows ?? [])
        .filter((m) => m.team_id === t.id)
        .map((m) => {
          const p = m.profiles as unknown as { full_name: string; is_setter: boolean } | null;
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
            overall: overallScore(scores),
            isSetter: p?.is_setter ?? false,
          };
        }),
    }));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brand-navy">Times</h1>
          <p className="mt-1 text-sm text-gray-500">
            Racha de {new Date(`${event.date}T00:00:00`).toLocaleDateString("pt-BR")} · {event.num_teams} times
          </p>
        </div>
        {profile.is_organizer && (
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

      {!generation && (
        <p className="text-sm text-gray-500">
          Os times ainda não foram gerados. {profile.is_organizer ? "Clique em \"Gerar times\" acima." : "Aguarde o organizador gerar."}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {teams.map((team) => {
          const sum = team.members.reduce((s, m) => s + m.overall, 0);
          return (
            <div key={team.id} className="rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-brand-navy">Time {team.teamNumber}</h3>
                <span className="text-xs text-gray-400">soma: {sum.toFixed(1)}</span>
              </div>
              <ul className="mt-3 space-y-2">
                {team.members.map((m) => (
                  <li key={m.teamMemberId} className="flex items-center justify-between text-sm">
                    <span className="text-brand-navy">
                      {m.isSetter && "🏐 "}
                      {m.fullName}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">{m.overall.toFixed(1)}</span>
                      {profile.is_organizer && (
                        <MoveTeamSelect
                          action={moveMember}
                          eventId={id}
                          teamMemberId={m.teamMemberId}
                          currentTeamId={team.id}
                          teams={teams.map((t) => ({ id: t.id, teamNumber: t.teamNumber }))}
                        />
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
