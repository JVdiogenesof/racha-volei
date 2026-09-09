import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPlayerRatings } from "@/lib/ratings";
import { SKILL_CATEGORIES, SKILL_LABELS } from "@/lib/scoring";
import { SkillSlider } from "@/components/SkillSlider";
import { Logo } from "@/components/Logo";
import { submitSelfRatings } from "./actions";

export default async function AutoavaliacaoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { self } = await getPlayerRatings(supabase, user.id);

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-16">
      <Logo className="mb-6" markClassName="h-12 w-12" />
      <h1 className="text-2xl font-bold text-brand-navy">Sua autoavaliação</h1>
      <p className="mt-1 text-sm text-gray-500">
        Antes de continuar, avalie seu próprio nível em cada habilidade (0 a
        5). Isso ajuda a gerar times mais equilibrados. Seja honesto — sua
        nota final também depende da avaliação dos organizadores.
      </p>

      <form action={submitSelfRatings} className="mt-8 space-y-5">
        {SKILL_CATEGORIES.map((c) => (
          <SkillSlider key={c} name={c} label={SKILL_LABELS[c]} defaultValue={self[c] ?? 2.5} />
        ))}
        <button
          type="submit"
          className="w-full rounded-lg bg-brand-purple px-4 py-3 font-medium text-white transition hover:bg-brand-purple-dark"
        >
          Salvar e continuar
        </button>
      </form>
    </div>
  );
}
