import { Sparkles } from "lucide-react";
import { NeonCard } from "./NeonCard";

export function NicknamePromptCard() {
  return (
    <NeonCard href="/perfil/dados" solid innerClassName="flex items-center gap-3 p-4">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/25 bg-white/15 text-white">
        <Sparkles className="h-5 w-5" strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-purple-300">Ainda sem insígnia</p>
        <p className="mt-1 text-sm text-white">Escolha um apelido divertido pra aparecer do lado do seu nome</p>
      </div>
    </NeonCard>
  );
}
