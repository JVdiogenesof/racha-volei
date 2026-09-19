"use client";

import { useState, useTransition } from "react";
import { FlaskConical, X, Loader2 } from "lucide-react";
import { Avatar } from "./Avatar";
import { SetterBadge } from "./SetterBadge";
import { useToast } from "./Toast";
import type { SimulatedTeam } from "@/app/(app)/racha/[id]/times/actions";

export function SimulateTeamsButton({
  eventId,
  action,
}: {
  eventId: string;
  action: (eventId: string, previousSignature?: string) => Promise<SimulatedTeam[]>;
}) {
  const [teams, setTeams] = useState<SimulatedTeam[] | null>(null);
  const [isPending, startTransition] = useTransition();
  const { showToast } = useToast();

  function handleClick() {
    startTransition(async () => {
      try {
        const previousSignature = teams
          ?.map((team) => [...team.members].map((member) => member.profileId).sort().join(","))
          .join("|");
        const result = await action(eventId, previousSignature);
        setTeams(result);
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Não foi possível simular os times.");
      }
    });
  }

  if (teams) {
    return (
      <section className="rounded-xl border border-dashed border-white/25 bg-white/[0.03] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="flex items-center gap-2 text-sm font-medium text-white/80">
            <FlaskConical className="h-4 w-4 shrink-0 text-white/50" strokeWidth={2} />
            Simulação — baseada em quem está confirmado agora. Não é o time oficial e não muda nada no racha.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClick}
              disabled={isPending}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-brand-purple/40 bg-brand-purple/10 px-3 py-1.5 text-xs font-medium text-purple-200 hover:bg-brand-purple/20 disabled:opacity-50"
            >
              {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FlaskConical className="h-3.5 w-3.5" />}
              Simular novamente
            </button>
            <button
              type="button"
              onClick={() => setTeams(null)}
              aria-label="Fechar simulação"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/40 hover:bg-white/10 hover:text-white/70"
            >
              <X className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {teams.map((team) => (
            <div key={team.teamNumber} className="rounded-lg border border-white/10 p-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-white">Time {team.teamNumber}</h4>
                <span className="text-xs text-white/40">soma: {team.sum.toFixed(1)}</span>
              </div>
              <ul className="mt-2 space-y-1.5">
                {team.members.map((m) => (
                  <li key={m.profileId} className="flex items-center gap-2 text-sm">
                    <Avatar src={m.avatarUrl} name={m.fullName} size="sm" />
                    <span className="min-w-0 flex-1 truncate text-white">{m.fullName}</span>
                    {m.isSetter && <SetterBadge />}
                    <span className="text-xs text-white/40">{m.overall.toFixed(1)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-white/25 px-4 py-2 text-sm font-medium text-white/70 hover:bg-white/5 disabled:opacity-50"
    >
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
      ) : (
        <FlaskConical className="h-4 w-4" strokeWidth={2} />
      )}
      Simular times (não oficial)
    </button>
  );
}
