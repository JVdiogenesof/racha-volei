"use client";

import { useState, type ReactNode } from "react";
import { Plus, X } from "lucide-react";
import { RachaForm, type RachaFormDefaults } from "./RachaForm";

export function CreateRachaPanel({
  title,
  action,
  defaults,
  hint,
}: {
  /** Fica ao lado do botão, na mesma linha -- assim o painel abre sempre
   * ocupando a largura inteira da página, sem disputar espaço com o título
   * dentro de um flex item encolhido. */
  title: ReactNode;
  action: (formData: FormData) => Promise<void>;
  defaults: RachaFormDefaults;
  hint?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-w-0 w-full">
      <div className="flex flex-wrap items-start justify-between gap-3">
        {title}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? "Fechar criação de racha" : "Criar racha"}
          className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl bg-brand-purple px-3.5 text-sm font-bold text-white hover:bg-brand-purple-dark"
        >
          {open ? <X className="h-4 w-4" strokeWidth={2.5} /> : <Plus className="h-4 w-4" strokeWidth={2.5} />}
          {open ? "Fechar" : "Criar"}
        </button>
      </div>

      {open && (
        <div className="mt-3 w-full min-w-0 rounded-2xl border border-white/10 bg-white/[0.035] p-3.5 sm:p-4">
          <RachaForm
            action={action}
            defaults={defaults}
            submitLabel="Criar racha"
            successMessage="Racha criado!"
            hint={hint}
            onSuccess={() => setOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
