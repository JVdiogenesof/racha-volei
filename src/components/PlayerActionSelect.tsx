"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "./Toast";

const MOVE_PREFIX = "move:";
const SWAP_PREFIX = "swap:";

export function PlayerActionSelect({
  moveAction,
  swapAction,
  eventId,
  teamMemberId,
  currentTeamId,
  teams,
  otherMembers,
}: {
  moveAction: (formData: FormData) => Promise<void> | void;
  swapAction: (formData: FormData) => Promise<void> | void;
  eventId: string;
  teamMemberId: string;
  currentTeamId: string;
  teams: { id: string; teamNumber: number }[];
  otherMembers: { teamMemberId: string; fullName: string; teamNumber: number }[];
}) {
  const { showToast } = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.currentTarget.value;
    if (!value) return;
    e.currentTarget.value = "";

    startTransition(async () => {
      try {
        if (value.startsWith(MOVE_PREFIX)) {
          const targetTeamId = value.slice(MOVE_PREFIX.length);
          const formData = new FormData();
          formData.set("eventId", eventId);
          formData.set("teamMemberId", teamMemberId);
          formData.set("targetTeamId", targetTeamId);
          await moveAction(formData);
          showToast("Jogador movido de time!");
        } else if (value.startsWith(SWAP_PREFIX)) {
          const swapWithTeamMemberId = value.slice(SWAP_PREFIX.length);
          const formData = new FormData();
          formData.set("eventId", eventId);
          formData.set("teamMemberId", teamMemberId);
          formData.set("swapWithTeamMemberId", swapWithTeamMemberId);
          await swapAction(formData);
          showToast("Jogadores trocados de time!");
        }
        router.refresh();
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Não foi possível concluir a ação.");
      }
    });
  }

  const otherTeams = teams.filter((t) => t.id !== currentTeamId);

  return (
    <select
      defaultValue=""
      onChange={handleChange}
      disabled={isPending}
      aria-label="Mover ou trocar jogador"
      className="rounded border border-white/15 bg-transparent text-xs text-white/60 disabled:opacity-50"
    >
      <option value="" disabled>
        Mover / trocar...
      </option>
      {otherTeams.length > 0 && (
        <optgroup label="Mover para">
          {otherTeams.map((t) => (
            <option key={t.id} value={`${MOVE_PREFIX}${t.id}`}>
              Time {t.teamNumber}
            </option>
          ))}
        </optgroup>
      )}
      {otherMembers.length > 0 && (
        <optgroup label="Trocar com">
          {otherMembers.map((m) => (
            <option key={m.teamMemberId} value={`${SWAP_PREFIX}${m.teamMemberId}`}>
              {m.fullName} (Time {m.teamNumber})
            </option>
          ))}
        </optgroup>
      )}
    </select>
  );
}
