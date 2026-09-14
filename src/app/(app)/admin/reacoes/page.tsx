import { Swords } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireOrganizer } from "@/lib/auth";
import { ActionForm } from "@/components/ActionForm";
import { DeleteReactionTypeButton } from "@/components/DeleteReactionTypeButton";
import { createReactionType, setReactionTypeActive, deleteReactionType } from "./actions";

export default async function AdminReacoesPage() {
  await requireOrganizer();
  const supabase = await createClient();

  const { data: reactionTypes } = await supabase
    .from("reaction_types")
    .select("id, text, active")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
          <Swords className="h-6 w-6 text-purple-300" strokeWidth={2} />
          Reações
        </h1>
        <p className="mt-1 text-sm text-white/60">
          Frases que aparecem pra galera escolher na hora de mandar uma reação/provocação pra alguém.
        </p>
      </div>

      <ActionForm
        action={createReactionType}
        successMessage="Reação criada!"
        resetOnSuccess
        className="space-y-3 rounded-xl border border-white/10 p-6"
      >
        <div>
          <label className="block text-sm font-medium text-white">Texto da nova reação</label>
          <input
            name="text"
            required
            placeholder='ex: chamou {alvo} pra um 1x1 no próximo racha 🔥'
            className="mt-1 w-full rounded-lg border border-white/15 px-3 py-2"
          />
          <p className="mt-1 text-xs text-white/40">
            Use <code>{"{alvo}"}</code> no lugar onde o nome de quem recebe deve entrar.
          </p>
        </div>
        <button
          type="submit"
          className="rounded-lg bg-brand-purple px-4 py-2 text-sm font-medium text-white hover:bg-brand-purple-dark"
        >
          Adicionar reação
        </button>
      </ActionForm>

      <section className="space-y-2">
        {(reactionTypes ?? []).map((rt) => (
          <div
            key={rt.id}
            className="flex flex-wrap items-center gap-3 rounded-lg border border-white/10 px-4 py-3"
          >
            <span className={`flex-1 text-sm ${rt.active ? "text-white" : "text-white/40 line-through"}`}>
              {rt.text}
            </span>
            <ActionForm action={setReactionTypeActive} successMessage={rt.active ? "Reação desativada." : "Reação ativada!"}>
              <input type="hidden" name="id" value={rt.id} />
              <input type="hidden" name="active" value={(!rt.active).toString()} />
              <button
                type="submit"
                className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 hover:bg-white/10"
              >
                {rt.active ? "Desativar" : "Ativar"}
              </button>
            </ActionForm>
            <DeleteReactionTypeButton reactionTypeId={rt.id} action={deleteReactionType} />
          </div>
        ))}
        {!reactionTypes?.length && (
          <p className="text-sm text-white/60">Nenhuma reação criada ainda.</p>
        )}
      </section>
    </div>
  );
}
