import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { getPlayerRatings, getRatingWeights } from "@/lib/ratings";
import { SKILL_CATEGORIES, SKILL_LABELS, finalScoresForPlayer, overallScore } from "@/lib/scoring";
import { SkillSlider } from "@/components/SkillSlider";
import { ScoreBar } from "@/components/ScoreBar";
import { ActionForm } from "@/components/ActionForm";
import { updateProfileData, updateSelfRatings } from "./actions";

export default async function PerfilPage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const [{ self, organizer }, weights] = await Promise.all([
    getPlayerRatings(supabase, profile.id),
    getRatingWeights(supabase),
  ]);

  const finalScores = finalScoresForPlayer(self, organizer, weights.selfWeight, weights.organizerWeight);
  const overall = overallScore(finalScores);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-brand-navy">Meu perfil</h1>
        <p className="text-sm text-gray-500">
          Sua nota final combina sua autoavaliação com a nota dos organizadores.
        </p>
      </div>

      <section className="rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold text-brand-navy">Nota final</h2>
        <p className="mt-1 text-sm text-gray-500">Geral: {overall.toFixed(1)} / 5</p>
        <div className="mt-4 space-y-3">
          {SKILL_CATEGORIES.map((c) => (
            <ScoreBar key={c} label={SKILL_LABELS[c]} value={finalScores[c]} />
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold text-brand-navy">Dados pessoais</h2>
        <ActionForm action={updateProfileData} successMessage="Dados salvos!" className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-brand-navy">Nome completo</label>
            <input
              name="fullName"
              defaultValue={profile.full_name}
              required
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-brand-purple focus:outline-none focus:ring-1 focus:ring-brand-purple"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-brand-navy">Data de aniversário</label>
            <input
              type="date"
              name="birthdate"
              defaultValue={profile.birthdate ?? ""}
              required
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-brand-purple focus:outline-none focus:ring-1 focus:ring-brand-purple"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-brand-navy">Telefone</label>
            <input
              name="phone"
              defaultValue={profile.phone ?? ""}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-brand-purple focus:outline-none focus:ring-1 focus:ring-brand-purple"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-brand-navy">
            <input
              type="checkbox"
              name="isSetter"
              defaultChecked={profile.is_setter}
              className="h-4 w-4 rounded border-gray-300 text-brand-purple focus:ring-brand-purple"
            />
            Eu jogo de levantador(a)
          </label>
          <button
            type="submit"
            className="rounded-lg bg-brand-purple px-4 py-2 font-medium text-white hover:bg-brand-purple-dark"
          >
            Salvar dados
          </button>
        </ActionForm>
      </section>

      <section className="rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold text-brand-navy">Minha autoavaliação</h2>
        <p className="mt-1 text-sm text-gray-500">
          Seja honesto — sua nota final também depende da avaliação dos organizadores.
        </p>
        <ActionForm action={updateSelfRatings} successMessage="Autoavaliação salva!" className="mt-4 space-y-5">
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
      </section>
    </div>
  );
}
