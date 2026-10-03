"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { FlaskConical, X, Loader2 } from "lucide-react";
import { Avatar } from "./Avatar";
import { SetterBadge } from "./SetterBadge";
import { useToast } from "./Toast";
import type { SimulatedTeam } from "@/app/(app)/racha/[id]/times/actions";

export function SimulateTeamsButton({
  eventId,
  action,
  compact = false,
}: {
  eventId: string;
  action: (eventId: string, previousSignature?: string) => Promise<SimulatedTeam[]>;
  compact?: boolean;
}) {
  const [teams, setTeams] = useState<SimulatedTeam[] | null>(null);
  const [isPending, startTransition] = useTransition();
  const { showToast } = useToast();

  useEffect(() => {
    if (!compact || !teams) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setTeams(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [compact, teams]);

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

  if (compact) {
    return (
      <>
        <button
          type="button"
          onClick={handleClick}
          disabled={isPending}
          aria-label="Simular times sem alterar o racha"
          title="Simular times (não oficial)"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-dashed border-cyan-300/30 bg-cyan-400/10 text-cyan-200 hover:bg-cyan-400/20 disabled:opacity-50"
        >
          {isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <FlaskConical className="h-5 w-5" strokeWidth={2} />}
        </button>

        {teams && typeof document !== "undefined" && createPortal(
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-5"
            onMouseDown={(event) => {
              if (event.currentTarget === event.target) setTeams(null);
            }}
          >
            <section role="dialog" aria-modal="true" aria-labelledby="simulation-title" className="max-h-[84dvh] w-full max-w-4xl overflow-y-auto rounded-t-3xl border border-white/15 bg-[#171122] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl sm:p-5">
              <div className="sticky top-0 z-10 flex items-start justify-between gap-3 bg-[#171122]/95 pb-3 backdrop-blur-xl">
                <div>
                  <h2 id="simulation-title" className="flex items-center gap-2 font-semibold text-white">
                    <FlaskConical className="h-4 w-4 text-cyan-300" /> Simulação de times
                  </h2>
                  <p className="mt-0.5 text-xs text-white/45">Prévia não oficial. Não altera os times do racha.</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button type="button" onClick={handleClick} disabled={isPending} aria-label="Simular novamente" title="Simular novamente" className="flex h-10 w-10 items-center justify-center rounded-full border border-purple-300/25 bg-purple-400/10 text-purple-200 hover:bg-purple-400/20 disabled:opacity-50">
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
                  </button>
                  <button type="button" onClick={() => setTeams(null)} aria-label="Fechar simulação" className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {teams.map((team) => (
                  <div key={team.teamNumber} className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-white">{team.name}</h3>
                      <span className="text-xs text-white/40">soma {team.sum.toFixed(1)}</span>
                    </div>
                    <ul className="mt-2 space-y-1.5">
                      {team.members.map((member) => (
                        <li key={member.profileId} className="flex items-center gap-2 text-sm">
                          <Avatar src={member.avatarUrl} name={member.fullName} size="sm" />
                          <span className="min-w-0 flex-1 truncate text-white">{member.fullName}</span>
                          {member.isSetter && <SetterBadge />}
                          <span className="text-xs text-white/40">{member.overall.toFixed(1)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          </div>,
          document.body,
        )}
      </>
    );
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
                <h4 className="text-sm font-semibold text-white">{team.name}</h4>
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
