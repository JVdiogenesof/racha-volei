"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Settings2 } from "lucide-react";
import { useToast } from "./Toast";

const MOVE_PREFIX = "move:";
const SWAP_PREFIX = "swap:";
const REPLACE_PREFIX = "replace:";
const REMOVE_VALUE = "remove";

export function PlayerActionSelect({
  moveAction,
  swapAction,
  replaceAction,
  removeAction,
  eventId,
  teamMemberId,
  currentTeamId,
  fullName,
  teams,
  otherMembers,
  unassignedConfirmed,
  compact = false,
}: {
  moveAction: (formData: FormData) => Promise<void> | void;
  swapAction: (formData: FormData) => Promise<void> | void;
  replaceAction: (formData: FormData) => Promise<void> | void;
  removeAction: (formData: FormData) => Promise<void> | void;
  eventId: string;
  teamMemberId: string;
  currentTeamId: string;
  fullName: string;
  teams: { id: string; teamNumber: number; name: string }[];
  otherMembers: { teamMemberId: string; fullName: string; teamNumber: number; teamName: string }[];
  /** Confirmados que ainda não caíram em nenhum time (ex: entraram depois da geração). */
  unassignedConfirmed: { profileId: string; fullName: string }[];
  compact?: boolean;
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
        } else if (value.startsWith(REPLACE_PREFIX)) {
          const newProfileId = value.slice(REPLACE_PREFIX.length);
          const formData = new FormData();
          formData.set("eventId", eventId);
          formData.set("teamMemberId", teamMemberId);
          formData.set("newProfileId", newProfileId);
          await replaceAction(formData);
          showToast("Jogador substituído no time!");
        } else if (value === REMOVE_VALUE) {
          if (!window.confirm(`Remover ${fullName} desse time? Ninguém entra no lugar.`)) return;
          const formData = new FormData();
          formData.set("eventId", eventId);
          formData.set("teamMemberId", teamMemberId);
          await removeAction(formData);
          showToast("Jogador removido do time.");
        }
        router.refresh();
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Não foi possível concluir a ação.");
      }
    });
  }

  const otherTeams = teams.filter((t) => t.id !== currentTeamId);

  const select = (
    <select
      defaultValue=""
      onChange={handleChange}
      disabled={isPending}
      aria-label="Mover ou trocar jogador"
      className={compact ? "absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed" : "min-h-11 w-full min-w-0 rounded border border-white/15 bg-transparent px-2 text-xs text-white/60 disabled:opacity-50"}
    >
      <option value="" disabled>
        Mover / trocar...
      </option>
      {otherTeams.length > 0 && (
        <optgroup label="Mover para">
          {otherTeams.map((t) => (
            <option key={t.id} value={`${MOVE_PREFIX}${t.id}`}>
              {t.name}
            </option>
          ))}
        </optgroup>
      )}
      {otherMembers.length > 0 && (
        <optgroup label="Trocar com">
          {otherMembers.map((m) => (
            <option key={m.teamMemberId} value={`${SWAP_PREFIX}${m.teamMemberId}`}>
              {m.fullName} ({m.teamName})
            </option>
          ))}
        </optgroup>
      )}
      {unassignedConfirmed.length > 0 && (
        <optgroup label="Substituir por (confirmado sem time)">
          {unassignedConfirmed.map((p) => (
            <option key={p.profileId} value={`${REPLACE_PREFIX}${p.profileId}`}>
              {p.fullName}
            </option>
          ))}
        </optgroup>
      )}
      <optgroup label="Remover">
        <option value={REMOVE_VALUE}>Remover do time</option>
      </optgroup>
    </select>
  );

  if (!compact) return select;

  return (
    <span
      title={`Gerenciar ${fullName}`}
      className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/50 hover:bg-white/10 hover:text-white"
    >
      <Settings2 className="h-4 w-4" strokeWidth={2} />
      {select}
    </span>
  );
}
