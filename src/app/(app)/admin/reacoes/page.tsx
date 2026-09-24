import { HeartHandshake } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireOrganizer } from "@/lib/auth";
import { ActionForm } from "@/components/ActionForm";
import { setQueridometroTypeActive } from "./actions";

export default async function AdminReacoesPage() {
  await requireOrganizer();
  const supabase = await createClient();
  const { data: reactionTypes } = await supabase
    .from("queridometro_reaction_types")
    .select("key, emoji, label, description, active")
    .order("sort_order");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
          <HeartHandshake className="h-6 w-6 text-purple-300" strokeWidth={2} />
          Queridômetro VPA
        </h1>
        <p className="mt-1 text-sm text-white/60">
          Escolha quais emojis aparecem na votação semanal. Desativar uma opção preserva todos os resultados anteriores.
        </p>
      </div>

      <section className="grid gap-3 sm:grid-cols-2">
        {(reactionTypes ?? []).map((reaction) => (
          <div key={reaction.key} className={`flex items-center gap-3 rounded-2xl border p-4 ${reaction.active ? "border-purple-300/20 bg-brand-purple/[0.08]" : "border-white/8 bg-white/[0.02] opacity-60"}`}>
            <span className="text-3xl">{reaction.emoji}</span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-white">{reaction.label}</p>
              <p className="mt-0.5 text-xs text-white/45">{reaction.description}</p>
            </div>
            <ActionForm action={setQueridometroTypeActive} successMessage={reaction.active ? `${reaction.label} foi ocultado.` : `${reaction.label} voltou à votação.`} className="shrink-0">
              <input type="hidden" name="key" value={reaction.key} />
              <input type="hidden" name="active" value={String(!reaction.active)} />
              <button type="submit" className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/70 hover:bg-white/10">
                {reaction.active ? "Ocultar" : "Ativar"}
              </button>
            </ActionForm>
          </div>
        ))}
      </section>
    </div>
  );
}
