"use client";

import { useState, useTransition, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "./Toast";
import { TEAM_VICTORY_EVENT } from "./VictoryTeamCard";

const PARTICLE_COUNT = 8;
const PARTICLES = Array.from({ length: PARTICLE_COUNT }, (_, i) => i);

export function MatchWinButton({
  action,
  eventId,
  teamId,
  teamNumber,
}: {
  action: (formData: FormData) => Promise<void> | void;
  eventId: string;
  teamId: string;
  teamNumber: number;
}) {
  const { showToast } = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [celebrating, setCelebrating] = useState(false);

  function handleClick() {
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("eventId", eventId);
        formData.set("teamId", teamId);
        await action(formData);
        showToast(`+1 vitória pro Time ${teamNumber}!`);
        window.dispatchEvent(new CustomEvent(TEAM_VICTORY_EVENT, { detail: { teamId } }));
        setCelebrating(true);
        setTimeout(() => setCelebrating(false), 700);
        router.refresh();
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Não foi possível concluir a ação.");
      }
    });
  }

  return (
    <span className="relative inline-flex">
      {celebrating && (
        <span
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
          aria-hidden="true"
        >
          {PARTICLES.map((i) => (
            <span
              key={i}
              className="confetti-particle"
              style={{ "--angle": `${(360 / PARTICLE_COUNT) * i}deg` } as CSSProperties}
            >
              🏐
            </span>
          ))}
        </span>
      )}
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="rounded-lg bg-brand-purple px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-purple-dark disabled:opacity-50"
      >
        {celebrating ? "Vitória!" : "+1 vitória"}
      </button>
    </span>
  );
}
