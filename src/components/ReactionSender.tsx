"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X, Loader2 } from "lucide-react";
import { Avatar } from "./Avatar";
import { useToast } from "./Toast";
import { renderReactionText } from "@/lib/reactions";

type Player = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  lastReceived: { text: string; fromName: string; createdAt: string } | null;
};

type ReactionType = { id: string; text: string };

export function ReactionSender({
  players,
  reactionTypes,
  currentProfileId,
  action,
}: {
  players: Player[];
  reactionTypes: ReactionType[];
  currentProfileId: string;
  action: (formData: FormData) => Promise<void>;
}) {
  const [targetId, setTargetId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { showToast } = useToast();
  const panelRef = useRef<HTMLDivElement>(null);

  const target = players.find((p) => p.id === targetId) ?? null;

  // A grade de jogadores pode ser longa -- sem isso, quem clica lá em cima
  // não percebe que o painel de escolher a reação apareceu mais embaixo.
  useEffect(() => {
    if (targetId) panelRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [targetId]);

  function handleSend(reactionTypeId: string) {
    if (!target) return;
    const formData = new FormData();
    formData.set("toProfileId", target.id);
    formData.set("reactionTypeId", reactionTypeId);
    startTransition(async () => {
      try {
        await action(formData);
        showToast("Reação enviada!");
        setTargetId(null);
        router.refresh();
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Não foi possível mandar a reação.");
      }
    });
  }

  return (
    <div className="mt-6">
      <p className="text-sm text-white/60">Clica na foto de alguém pra mandar uma reação:</p>
      <div className="mt-3 grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5">
        {players.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setTargetId((current) => (current === p.id ? null : p.id))}
            className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition ${
              targetId === p.id
                ? "border-brand-purple bg-brand-purple/15"
                : "border-white/10 hover:bg-white/5"
            }`}
          >
            <Avatar src={p.avatar_url} name={p.full_name} size="md" />
            <span className="w-full truncate text-xs font-medium text-white">
              {p.id === currentProfileId ? `${p.full_name} (você)` : p.full_name}
            </span>
            {p.lastReceived && (
              <span className="w-full truncate text-[10px] text-white/40">{p.lastReceived.text}</span>
            )}
          </button>
        ))}
      </div>

      {target && (
        <div ref={panelRef} className="mt-4 rounded-xl border border-brand-purple/40 bg-brand-purple/10 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-white">
              Mandar reação pra <strong>{target.full_name}</strong>:
            </p>
            <button
              type="button"
              onClick={() => setTargetId(null)}
              aria-label="Cancelar"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white/40 hover:bg-white/10 hover:text-white/70"
            >
              <X className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {reactionTypes.map((rt) => (
              <button
                key={rt.id}
                type="button"
                disabled={isPending}
                onClick={() => handleSend(rt.id)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-white hover:bg-white/10 disabled:opacity-50"
              >
                {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />}
                {renderReactionText(rt.text, target.full_name)}
              </button>
            ))}
            {!reactionTypes.length && (
              <p className="text-sm text-white/60">Nenhuma reação disponível no momento.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
