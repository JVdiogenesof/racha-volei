import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { getPlayerRatings } from "@/lib/ratings";
import { SKILL_CATEGORIES, SKILL_LABELS } from "@/lib/scoring";
import { SkillSlider } from "@/components/SkillSlider";
import { ActionForm } from "@/components/ActionForm";
import { updateSelfRatings } from "../actions";

export default async function PerfilAutoavaliacaoPage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { self } = await getPlayerRatings(supabase, profile.id);

  return (
    <div>
      <h1 className="text-2xl font-bold text-white">Autoavaliação</h1>
      <p className="mt-1 text-sm text-white/60">
        Seja honesto — sua nota final também depende da avaliação dos organizadores.
      </p>

      <ActionForm
        action={updateSelfRatings}
        successMessage="Autoavaliação salva!"
        className="mt-6 space-y-5 rounded-xl border border-white/10 p-6"
      >
        {SKILL_CATEGORIES.map((c) => (
          <SkillSlider key={c} name={c} label={SKILL_LABELS[c]} defaultValue={self[c] ?? 2.5} />
        ))}
        <button
          type="submit"
          className="rounded-lg bg-brand-purple px-4 py-2 font-medium text-white hover:bg-brand-purple-dark"
        >
          Salvar autoavaliação
        </button>
      </ActionForm>
    </div>
  );
}
