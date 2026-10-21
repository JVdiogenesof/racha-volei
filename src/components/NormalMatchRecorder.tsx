"use client";

import { useState, useTransition } from "react";
import { RotateCcw, Swords, Trophy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "./Toast";
import { TEAM_VICTORY_EVENT } from "./VictoryTeamCard";
import { EmptyState } from "./EmptyState";
import { TeamBadge } from "./TeamBadge";

type TeamOption = { id: string; teamNumber: number; name: string };
type Confrontation = {
  id: string;
  winnerTeamId: string;
  loserTeamId: string;
  winnerScore: number | null;
  loserScore: number | null;
};

type MatchAction = (formData: FormData) => Promise<void> | void;

export function NormalMatchRecorder({
  eventId,
  teams,
  confrontations,
  isOrganizer,
  recordAction,
  undoAction,
}: {
  eventId: string;
  teams: TeamOption[];
  confrontations: Confrontation[];
  isOrganizer: boolean;
  recordAction: MatchAction;
  undoAction: MatchAction;
}) {
  const [teamAId, setTeamAId] = useState("");
  const [teamBId, setTeamBId] = useState("");
  const [scoreA, setScoreA] = useState("");
  const [scoreB, setScoreB] = useState("");
  const [undoingId, setUndoingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { showToast } = useToast();
  const router = useRouter();
  const labels = new Map(teams.map((team) => [team.id, team.name]));

  function record() {
    if (!teamAId || !teamBId || scoreA === "" || scoreB === "") return;
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("eventId", eventId);
        formData.set("teamAId", teamAId);
        formData.set("teamBId", teamBId);
        formData.set("scoreA", scoreA);
        formData.set("scoreB", scoreB);
        const winnerTeamId = Number(scoreA) > Number(scoreB) ? teamAId : teamBId;
        await recordAction(formData);
        showToast(`Vitória do ${labels.get(winnerTeamId)} registrada!`);
        window.dispatchEvent(new CustomEvent(TEAM_VICTORY_EVENT, { detail: { teamId: winnerTeamId } }));
        setTeamAId("");
        setTeamBId("");
        setScoreA("");
        setScoreB("");
        router.refresh();
      } catch (error) {
        showToast(error instanceof Error ? error.message : "Não foi possível registrar o confronto.");
      }
    });
  }

  function undo(matchWinId: string) {
    setUndoingId(matchWinId);
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("eventId", eventId);
        formData.set("matchWinId", matchWinId);
        await undoAction(formData);
        showToast("Confronto desfeito.");
        router.refresh();
      } catch (error) {
        showToast(error instanceof Error ? error.message : "Não foi possível desfazer o confronto.");
      } finally {
        setUndoingId(null);
      }
    });
  }

  const canRecord = teamAId && teamBId && scoreA !== "" && scoreB !== "" && Number(scoreA) !== Number(scoreB);

  return (
    <section className="rounded-2xl border border-purple-300/20 bg-purple-400/5 p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <Swords className="h-5 w-5 text-purple-300" strokeWidth={2} />
        <div>
          <h2 className="font-semibold text-white">Confrontos</h2>
          <p className="text-xs text-white/50">Escolha os dois times e lance o placar do confronto.</p>
        </div>
      </div>

      {isOrganizer && (
        <div className="mt-4 rounded-xl border border-white/10 bg-black/10 p-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
            <label className="text-xs font-medium text-white/60">
              Primeiro time
              <select
                value={teamAId}
                onChange={(event) => {
                  setTeamAId(event.target.value);
                  if (event.target.value === teamBId) setTeamBId("");
                }}
                disabled={isPending}
                className="mt-1.5 min-h-11 w-full rounded-lg border border-white/15 bg-[#1c1238] px-3 text-sm text-white outline-none focus:border-purple-300"
              >
                <option value="">Escolher time</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>{team.name}</option>
                ))}
              </select>
            </label>

            <span className="hidden pb-3 text-xs font-bold text-white/35 sm:block">X</span>

            <label className="text-xs font-medium text-white/60">
              Segundo time
              <select
                value={teamBId}
                onChange={(event) => setTeamBId(event.target.value)}
                disabled={isPending}
                className="mt-1.5 min-h-11 w-full rounded-lg border border-white/15 bg-[#1c1238] px-3 text-sm text-white outline-none focus:border-purple-300"
              >
                <option value="">Escolher time</option>
                {teams.filter((team) => team.id !== teamAId).map((team) => (
                  <option key={team.id} value={team.id}>{team.name}</option>
                ))}
              </select>
            </label>
          </div>

          {teamAId && teamBId && (
            <div className="mt-4">
              <p className="mb-2 text-center text-xs font-medium uppercase tracking-wide text-white/45">Placar final</p>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <div className="flex flex-col items-center gap-1.5">
                  <TeamBadge name={labels.get(teamAId) ?? ""} size={22} />
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={scoreA}
                    onChange={(event) => setScoreA(event.target.value)}
                    disabled={isPending}
                    placeholder="0"
                    className="min-h-12 w-full rounded-lg border border-white/15 bg-[#1c1238] px-3 text-center text-lg font-bold text-white outline-none focus:border-purple-300"
                  />
                </div>
                <span className="pt-6 text-sm font-bold text-white/35">X</span>
                <div className="flex flex-col items-center gap-1.5">
                  <TeamBadge name={labels.get(teamBId) ?? ""} size={22} />
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={scoreB}
                    onChange={(event) => setScoreB(event.target.value)}
                    disabled={isPending}
                    placeholder="0"
                    className="min-h-12 w-full rounded-lg border border-white/15 bg-[#1c1238] px-3 text-center text-lg font-bold text-white outline-none focus:border-purple-300"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={record}
                disabled={isPending || !canRecord}
                className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-purple px-3 text-sm font-semibold text-white hover:bg-brand-purple-dark disabled:opacity-50"
              >
                <Trophy className="h-4 w-4" strokeWidth={2} />
                {isPending ? "Registrando..." : "Registrar confronto"}
              </button>
            </div>
          )}
        </div>
      )}

      <div className="mt-4">
        <h3 className="text-sm font-medium text-white">Histórico do racha</h3>
        {!confrontations.length ? (
          <div className="mt-2"><EmptyState compact icon={<Swords className="h-5 w-5" />} title="A quadra está pronta" description="Escolha dois times acima e registre o placar do primeiro confronto." /></div>
        ) : (
          <ol className="mt-2 space-y-2">
            {confrontations.map((match, index) => (
              <li key={match.id} className="flex min-w-0 items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-purple-400/15 text-xs font-bold text-purple-200">
                  {confrontations.length - index}
                </span>
                <p className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-white">
                  <strong><TeamBadge name={labels.get(match.winnerTeamId) ?? "Time anterior"} size={22} /></strong>
                  {match.winnerScore != null && match.loserScore != null ? (
                    <span className="font-mono text-xs font-bold text-emerald-300">{match.winnerScore}×{match.loserScore}</span>
                  ) : (
                    <span className="text-white/45">venceu o</span>
                  )}
                  <TeamBadge name={labels.get(match.loserTeamId) ?? "time anterior"} size={22} className="text-white/80" />
                </p>
                {isOrganizer && (
                  <button
                    type="button"
                    onClick={() => undo(match.id)}
                    disabled={isPending}
                    aria-label="Desfazer confronto"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/45 hover:bg-white/10 hover:text-white disabled:opacity-50"
                  >
                    <RotateCcw className={`h-4 w-4 ${undoingId === match.id ? "animate-spin" : ""}`} strokeWidth={2} />
                  </button>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
