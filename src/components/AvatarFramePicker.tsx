"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { Avatar } from "./Avatar";
import { useToast } from "./Toast";
import { AVATAR_FRAMES } from "@/lib/avatarFrames";
import { setAvatarFrame } from "@/app/(app)/perfil/actions";

/** Escolha da moldura da foto: cada opção mostra a PRÓPRIA foto da pessoa com a moldura. */
export function AvatarFramePicker({
  fullName,
  avatarUrl,
  currentFrame,
  streak,
}: {
  fullName: string;
  avatarUrl: string | null;
  currentFrame: string | null;
  streak: number;
}) {
  const [selected, setSelected] = useState<string | null>(currentFrame);
  const [pending, startTransition] = useTransition();
  const { showToast } = useToast();

  function choose(frameId: string | null, label: string) {
    if (frameId === selected || pending) return;
    const previous = selected;
    setSelected(frameId);
    startTransition(async () => {
      try {
        await setAvatarFrame(frameId);
        showToast(frameId ? `Moldura "${label}" aplicada!` : "Moldura removida.");
      } catch (error) {
        setSelected(previous);
        showToast(error instanceof Error ? error.message : "Não foi possível trocar a moldura.");
      }
    });
  }

  const options: { id: string | null; name: string; tagline: string }[] = [
    { id: null, name: "Sem moldura", tagline: "Só a sua foto" },
    ...AVATAR_FRAMES,
  ];

  return (
    <section aria-labelledby="molduras-titulo">
      <h2 id="molduras-titulo" className="font-semibold text-white">Minha moldura</h2>
      <p className="mt-1 text-sm text-white/60">
        Escolha como sua foto aparece no ranking, nas listas e na busca de jogadores.
        {streak >= 3 ? " Seu fogo de sequência continua aceso por trás. 🔥" : ""}
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {options.map((option) => {
          const active = option.id === selected;
          return (
            <button
              key={option.id ?? "none"}
              type="button"
              onClick={() => choose(option.id, option.name)}
              aria-pressed={active}
              disabled={pending}
              className={`relative flex flex-col items-center rounded-2xl border px-2 pb-3 pt-11 text-center transition ${
                active
                  ? "border-purple-300/70 bg-purple-400/15 shadow-[0_0_0_1px_rgba(196,181,253,.35)]"
                  : "border-white/10 bg-white/[0.04] hover:border-white/25 hover:bg-white/[0.07]"
              } disabled:opacity-70`}
            >
              {active && (
                <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-purple-400 text-white">
                  <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
                </span>
              )}
              <Avatar src={avatarUrl} name={fullName} size="lg" frame={option.id} />
              <span className="mt-6 text-sm font-bold leading-tight text-white">{option.name}</span>
              <span className="mt-0.5 text-[11px] leading-tight text-white/50">{option.tagline}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
