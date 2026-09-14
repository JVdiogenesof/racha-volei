import Link from "next/link";
import { Sparkles } from "lucide-react";

export function NicknamePromptCard() {
  return (
    <Link
      href="/perfil/dados"
      className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:bg-white/10"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-purple/20 text-purple-200">
        <Sparkles className="h-5 w-5" strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-purple-300">Ainda sem insígnia</p>
        <p className="mt-1 text-sm text-white">Escolha um apelido divertido pra aparecer do lado do seu nome</p>
      </div>
    </Link>
  );
}
