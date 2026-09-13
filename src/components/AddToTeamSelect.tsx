"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "./Toast";

export function AddToTeamSelect({
  action,
  eventId,
  teamId,
  players,
}: {
  action: (formData: FormData) => Promise<void> | void;
  eventId: string;
  teamId: string;
  players: { profileId: string; fullName: string }[];
}) {
  const { showToast } = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const profileId = e.currentTarget.value;
    if (!profileId) return;
    e.currentTarget.value = "";

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("eventId", eventId);
        formData.set("teamId", teamId);
        formData.set("profileId", profileId);
        await action(formData);
        showToast("Jogador adicionado no time!");
        router.refresh();
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Não foi possível concluir a ação.");
      }
    });
  }

  return (
    <select
      defaultValue=""
      onChange={handleChange}
      disabled={isPending}
      aria-label="Adicionar jogador no time"
      className="w-full rounded-lg border border-dashed border-white/20 bg-transparent px-2 py-1.5 text-xs text-white/60 disabled:opacity-50"
    >
      <option value="" disabled>
        + Adicionar jogador...
      </option>
      {players.map((p) => (
        <option key={p.profileId} value={p.profileId}>
          {p.fullName}
        </option>
      ))}
    </select>
  );
}
