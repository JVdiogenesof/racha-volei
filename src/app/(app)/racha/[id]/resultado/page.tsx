import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Crown, Medal, Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { computeStandings } from "@/lib/torneioStandings";
import { Avatar } from "@/components/Avatar";

type ResultTeam = {
  id: string;
  teamNumber: number;
  members: { profileId: string; fullName: string; avatarUrl: string | null }[];
};

type MatchRow = {
  stage: "group" | "final" | "third_place";
  team_a_id: string;
  team_b_id: string;
  score_a: number | null;
  score_b: number | null;
};

const PLACE_STYLE = {
  1: {
    label: "Campeão",
    icon: Crown,
    card: "border-amber-400/50 bg-gradient-to-br from-amber-400/20 via-amber-500/10 to-transparent shadow-lg shadow-amber-500/10",
    badge: "bg-amber-400 text-amber-950",
    iconClass: "text-amber-300",
  },
  2: {
    label: "Vice-campeão",
    icon: Medal,
    card: "border-slate-300/30 bg-gradient-to-br from-slate-200/15 to-transparent",
    badge: "bg-slate-200 text-slate-900",
    iconClass: "text-slate-200",
  },
  3: {
    label: "3º lugar",
    icon: Medal,
    card: "border-orange-400/30 bg-gradient-to-br from-orange-500/15 to-transparent",
    badge: "bg-orange-500 text-white",
    iconClass: "text-orange-400",
  },
  4: {
    label: "4º lugar",
    icon: Medal,
    card: "border-white/10 bg-white/[0.03]",
    badge: "bg-white/15 text-white/80",
    iconClass: "text-white/50",
  },
} as const;

export default async function ResultadoFinalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireProfile();
  const supabase = await createClient();

  const [{ data: event }, { data: generation }] = await Promise.all([
    supabase.from("events").select("id, date, is_pre_torneio").eq("id", id).maybeSingle(),
    supabase
      .from("team_generations")
      .select("id")
      .eq("event_id", id)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (!event || !event.is_pre_torneio) notFound();

  const dateLabel = new Date(`${event.date}T00:00:00`).toLocaleDateString("pt-BR");
  if (!generation) return <WaitingResult eventId={id} dateLabel={dateLabel} />;

  const [{ data: teamRows }, { data: matchRows }] = await Promise.all([
    supabase.from("teams").select("id, team_number").eq("generation_id", generation.id).order("team_number"),
    supabase
      .from("tournament_matches")
      .select("stage, team_a_id, team_b_id, score_a, score_b")
      .eq("event_id", id),
  ]);
  const teamIds = (teamRows ?? []).map((team) => team.id);
  const { data: memberRows } = teamIds.length
    ? await supabase
        .from("team_members")
        .select("team_id, profile_id, profiles(full_name, avatar_url)")
        .in("team_id", teamIds)
    : { data: [] };

  const teams: ResultTeam[] = (teamRows ?? []).map((team) => ({
    id: team.id,
    teamNumber: team.team_number,
    members: (memberRows ?? [])
      .filter((member) => member.team_id === team.id)
      .map((member) => {
        const player = member.profiles as unknown as { full_name: string; avatar_url: string | null } | null;
        return {
          profileId: member.profile_id,
          fullName: player?.full_name ?? "Jogador",
          avatarUrl: player?.avatar_url ?? null,
        };
      }),
  }));

  const matches = (matchRows ?? []) as MatchRow[];
  const finalMatch = matches.find((match) => match.stage === "final");
  if (!finalMatch || finalMatch.score_a == null || finalMatch.score_b == null) {
    return <WaitingResult eventId={id} dateLabel={dateLabel} />;
  }

  const groupMatches = matches.filter((match) => match.stage === "group");
  const standings = computeStandings(
    teams.map((team) => ({ id: team.id, teamNumber: team.teamNumber })),
    groupMatches.map((match) => ({
      teamAId: match.team_a_id,
      teamBId: match.team_b_id,
      scoreA: match.score_a,
      scoreB: match.score_b,
    })),
  );
  const thirdPlaceMatch = matches.find((match) => match.stage === "third_place");
  const championId = finalMatch.score_a > finalMatch.score_b ? finalMatch.team_a_id : finalMatch.team_b_id;
  const runnerUpId = championId === finalMatch.team_a_id ? finalMatch.team_b_id : finalMatch.team_a_id;
  const thirdId =
    thirdPlaceMatch?.score_a != null && thirdPlaceMatch.score_b != null
      ? thirdPlaceMatch.score_a > thirdPlaceMatch.score_b
        ? thirdPlaceMatch.team_a_id
        : thirdPlaceMatch.team_b_id
      : standings[2]?.teamId;
  const fourthId =
    thirdPlaceMatch?.score_a != null && thirdPlaceMatch.score_b != null
      ? thirdId === thirdPlaceMatch.team_a_id
        ? thirdPlaceMatch.team_b_id
        : thirdPlaceMatch.team_a_id
      : standings[3]?.teamId;
  const teamById = new Map(teams.map((team) => [team.id, team]));
  const placements = [championId, runnerUpId, thirdId, fourthId]
    .map((teamId, index) => ({ place: (index + 1) as 1 | 2 | 3 | 4, team: teamId ? teamById.get(teamId) : undefined }))
    .filter((entry): entry is { place: 1 | 2 | 3 | 4; team: ResultTeam } => Boolean(entry.team));

  return (
    <div className="space-y-6">
      <Link href={`/racha/${id}`} className="inline-flex items-center gap-1.5 text-sm text-white/60 hover:text-white">
        <ArrowLeft className="h-4 w-4" strokeWidth={2} />
        Voltar para o racha
      </Link>

      <header className="relative overflow-hidden rounded-3xl border border-amber-400/30 bg-gradient-to-br from-amber-500/20 via-brand-purple/15 to-transparent px-5 py-8 text-center sm:px-8 sm:py-10">
        <div aria-hidden className="absolute -left-16 -top-20 h-48 w-48 rounded-full bg-amber-400/15 blur-3xl" />
        <div aria-hidden className="absolute -bottom-20 -right-16 h-48 w-48 rounded-full bg-brand-purple/25 blur-3xl" />
        <div className="relative">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-400/20 ring-1 ring-amber-300/40">
            <Trophy className="h-8 w-8 text-amber-300" strokeWidth={1.8} />
          </span>
          <p className="mt-4 text-xs font-bold tracking-[0.25em] text-amber-300 uppercase">Pré-torneio VPA</p>
          <h1 className="mt-2 text-3xl font-extrabold text-white sm:text-4xl">Resultado final</h1>
          <p className="mt-2 text-sm text-white/60">{dateLabel}</p>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {placements.map(({ place, team }) => (
          <PlacementCard key={team.id} place={place} team={team} />
        ))}
      </div>
    </div>
  );
}

function PlacementCard({ place, team }: { place: 1 | 2 | 3 | 4; team: ResultTeam }) {
  const style = PLACE_STYLE[place];
  const Icon = style.icon;

  return (
    <section className={`min-w-0 rounded-2xl border p-4 sm:p-5 ${style.card} ${place === 1 ? "sm:col-span-2" : ""}`}>
      <div className="flex items-center gap-3">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${style.badge}`}>
          <span className="text-lg font-black">{place}º</span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 font-bold text-white">
            <Icon className={`h-4 w-4 ${style.iconClass}`} strokeWidth={2} />
            {style.label}
          </p>
          <p className="text-sm text-white/50">Time {team.teamNumber}</p>
        </div>
      </div>

      <ul className={`mt-5 grid gap-3 ${place === 1 ? "sm:grid-cols-2 lg:grid-cols-3" : ""}`}>
        {team.members.map((member) => (
          <li key={member.profileId} className="flex min-w-0 items-center gap-3 rounded-xl bg-black/15 px-3 py-2.5">
            <Avatar src={member.avatarUrl} name={member.fullName} size={place === 1 ? "lg" : "md"} />
            <span className="min-w-0 break-words text-sm font-medium text-white">{member.fullName}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function WaitingResult({ eventId, dateLabel }: { eventId: string; dateLabel: string }) {
  return (
    <div className="space-y-6">
      <Link href={`/racha/${eventId}`} className="inline-flex items-center gap-1.5 text-sm text-white/60 hover:text-white">
        <ArrowLeft className="h-4 w-4" strokeWidth={2} />
        Voltar para o racha
      </Link>
      <section className="rounded-2xl border border-white/10 p-8 text-center">
        <Trophy className="mx-auto h-12 w-12 text-white/25" strokeWidth={1.5} />
        <h1 className="mt-4 text-2xl font-bold text-white">Resultado final</h1>
        <p className="mt-1 text-sm text-white/50">Pré-torneio de {dateLabel}</p>
        <p className="mt-4 text-sm text-white/60">O pódio aparecerá aqui assim que o placar da final for salvo.</p>
      </section>
    </div>
  );
}
