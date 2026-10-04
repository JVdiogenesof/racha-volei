"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, UserPlus } from "lucide-react";
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
  players: { profileId: string; fullName: string; status: "confirmed" | "interested" }[];
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

  const hasPlayers = players.length > 0;

  return (
    <div className="rounded-xl border border-dashed border-purple-300/25 bg-purple-400/[0.06] p-2.5">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-purple-100">
        {isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
        Completar time
      </div>
      <select
        defaultValue=""
        onChange={handleChange}
        disabled={isPending || !hasPlayers}
        aria-label="Adicionar jogador no time"
        className="w-full rounded-lg border border-white/15 bg-[#20152f] px-2.5 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-55"
      >
        <option value="" disabled>
          {isPending ? "Adicionando..." : hasPlayers ? "Escolher jogador..." : "Nenhum jogador disponível"}
        </option>
        {players.map((p) => (
          <option key={p.profileId} value={p.profileId}>
            {p.fullName}{p.status === "interested" ? " · interessado" : ""}
          </option>
        ))}
      </select>
      <p className="mt-1.5 text-[11px] leading-4 text-white/45">
        {hasPlayers
          ? "Quem está como interessado será confirmado automaticamente ao entrar no time."
          : "Quando alguém marcar interesse ou for confirmado, aparecerá aqui para você adicionar."}
      </p>
    </div>
  );
}
