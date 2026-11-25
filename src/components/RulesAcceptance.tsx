"use client";

import { useState, useTransition } from "react";
import { ScrollText } from "lucide-react";
import { Logo } from "./Logo";
import { RegulamentoTabs } from "./RegulamentoTabs";
import { acceptRules } from "@/app/(app)/rulesActions";
import { RULES_UPDATED_LABEL } from "@/lib/rulesVersion";

/**
 * Tela de primeiro acesso depois de uma nova versão do regulamento: a pessoa
 * lê as regras e precisa aceitar para continuar usando o app.
 */
export function RulesAcceptance({ name }: { name: string }) {
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        await acceptRules();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Não foi possível registrar o aceite. Tente de novo.");
      }
    });
  }

  return (
    <div className="mx-auto min-h-screen w-full max-w-2xl px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-8">
      <Logo className="mb-5" markClassName="h-12 w-12" />
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-400/20 text-purple-200">
          <ScrollText className="h-5 w-5" strokeWidth={2.25} />
        </span>
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-white">Regulamento VPA</h1>
          <p className="mt-1 text-sm leading-relaxed text-white/60">
            {name.split(" ")[0]}, as regras do VPA foram atualizadas ({RULES_UPDATED_LABEL}). Leia com calma e aceite para continuar usando o app.
          </p>
        </div>
      </div>

      <div className="mt-6">
        <RegulamentoTabs />
      </div>

      <div className="sticky bottom-0 -mx-4 mt-6 border-t border-white/10 bg-brand-navy/95 px-4 py-4 backdrop-blur">
        <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-white/80">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 rounded border-white/20 text-purple-400 focus:ring-purple-400"
          />
          <span>Li o regulamento do VPA e aceito os termos.</span>
        </label>
        {error && <p role="alert" className="mt-2 text-xs text-red-300">{error}</p>}
        <button
          type="button"
          disabled={!agreed || pending}
          onClick={submit}
          className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-brand-purple px-4 text-sm font-bold text-white shadow-md shadow-purple-950/30 transition enabled:hover:brightness-110 disabled:opacity-40"
        >
          {pending ? "Registrando..." : "Aceitar e continuar"}
        </button>
      </div>
    </div>
  );
}
