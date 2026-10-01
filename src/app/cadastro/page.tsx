import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ATTENDANCE_FREQUENCY_OPTIONS } from "@/lib/attendanceFrequency";
import { SKILL_CATEGORIES, SKILL_LABELS } from "@/lib/scoring";
import { getPlayerRatings } from "@/lib/ratings";
import { SkillSlider } from "@/components/SkillSlider";
import { submitSignup } from "./actions";

export default async function CadastroPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { self: selfRatings }] = await Promise.all([
    supabase
      .from("profiles")
      .select("status, full_name, birthdate, phone, instagram_handle, is_setter, attendance_frequency, has_vpa_shirt, wants_tournaments, player_level, communities")
      .eq("id", user.id)
      .maybeSingle(),
    getPlayerRatings(supabase, user.id),
  ]);
  const completingApprovedProfile = profile?.status === "approved";
  const defaultName = profile?.full_name ?? (user.user_metadata?.full_name as string | undefined) ?? "";

  return (
    <div className="mx-auto min-h-screen max-w-2xl px-5 py-10 sm:px-6 sm:py-14">
      <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 shadow-2xl shadow-black/20 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-purple-300">Cadastro VPA</p>
        <h1 className="mt-2 text-2xl font-black text-white sm:text-3xl">
          {completingApprovedProfile ? "Complete seu perfil" : "Uma entrada para todo mundo"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-white/60">
          {completingApprovedProfile
            ? "Preencha os dados que faltam para continuar usando seu acesso completo."
            : "Depois do cadastro você já poderá conhecer o app. Um organizador poderá chamar você para um racha ou liberar seu acesso completo."}
        </p>

        <form action={submitSignup} className="mt-8 space-y-6">
          <section className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome completo" className="sm:col-span-2">
              <input name="fullName" defaultValue={defaultName} required className={inputClass} />
            </Field>
            <Field label="Data de aniversário">
              <input type="date" name="birthdate" defaultValue={profile?.birthdate ?? ""} required className={inputClass} />
            </Field>
            <Field label="Telefone / WhatsApp">
              <input name="phone" defaultValue={profile?.phone ?? ""} required placeholder="(85) 90000-0000" className={inputClass} />
            </Field>
            <Field label="Qual é o seu @ do Instagram?">
              <input name="instagramHandle" defaultValue={profile?.instagram_handle ?? ""} required autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="@seuusuario" className={inputClass} />
            </Field>
            {!completingApprovedProfile && (
              <Field label="Bairro">
                <input name="neighborhood" required placeholder="Ex.: Aldeota" className={inputClass} />
              </Field>
            )}
            <Field label="Seu nível">
              <select name="playerLevel" defaultValue={profile?.player_level ?? ""} required className={inputClass}>
                <option value="" disabled>Selecione</option>
                <option value="beginner">Iniciante</option>
                <option value="intermediate">Intermediário</option>
                <option value="advanced">Avançado</option>
              </select>
            </Field>
            <fieldset className="sm:col-span-2">
              <legend className="text-sm font-medium text-white">Onde você joga?</legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                <Radio name="playCommunity" value="court" label="🏐 Quadra" defaultChecked={(profile?.communities ?? ["court"]).length === 1 && (profile?.communities ?? ["court"]).includes("court")} />
                <Radio name="playCommunity" value="sand" label="🏖️ Areia" defaultChecked={profile?.communities?.length === 1 && profile.communities.includes("sand")} />
                <Radio name="playCommunity" value="both" label="Quadra e areia" defaultChecked={profile?.communities?.includes("court") && profile.communities.includes("sand")} />
              </div>
            </fieldset>
          </section>

          {!completingApprovedProfile && (
            <section className="space-y-4 rounded-2xl border border-purple-300/15 bg-purple-400/[0.06] p-4 sm:p-5">
              <div>
                <h2 className="font-bold text-white">Como você chegou até o VPA?</h2>
                <p className="mt-1 text-xs text-white/45">Isso ajuda os organizadores a identificar e acolher cada pessoa.</p>
              </div>
              <Field label="Por onde conheceu nosso racha?">
                <input name="howHeard" required placeholder="Ex.: Instagram, amigo, jogando na quadra..." className={inputClass} />
              </Field>
              <Field label="Quem você conhece do racha?">
                <input name="knownPeople" required placeholder="Digite os nomes ou escreva “ninguém”" className={inputClass} />
              </Field>
              <fieldset>
                <legend className="text-sm font-medium text-white">Você gostaria de se tornar membro oficial do grupo VPA?</legend>
                <div className="mt-2 flex flex-wrap gap-3">
                  <Radio name="wantsOfficialMembership" value="yes" label="Sim, tenho interesse" />
                  <Radio name="wantsOfficialMembership" value="no" label="Por enquanto, só conhecer" />
                </div>
              </fieldset>
            </section>
          )}

          <section className="grid gap-5 border-t border-white/10 pt-6 sm:grid-cols-2">
            <fieldset>
              <legend className="text-sm font-medium text-white">Posição que joga</legend>
              <div className="mt-2 flex gap-4 text-sm text-white">
                <Radio name="position" value="attacker" label="Atacando" defaultChecked={!profile?.is_setter} />
                <Radio name="position" value="setter" label="Levantando" defaultChecked={profile?.is_setter ?? false} />
              </div>
            </fieldset>
            <Field label="Pretende ir quantas vezes?">
              <select name="attendanceFrequency" defaultValue={profile?.attendance_frequency ?? "weekly"} className={inputClass}>
                {ATTENDANCE_FREQUENCY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </Field>
            <label className="flex items-center gap-2 text-sm text-white">
              <input type="checkbox" name="hasVpaShirt" defaultChecked={profile?.has_vpa_shirt ?? false} className="h-4 w-4 rounded border-white/15 text-purple-300 focus:ring-brand-purple" />
              Já tenho a camisa do VPA
            </label>
            <label className="flex items-center gap-2 text-sm text-white">
              <input type="checkbox" name="wantsTournaments" defaultChecked={profile?.wants_tournaments ?? false} className="h-4 w-4 rounded border-white/15 text-purple-300 focus:ring-brand-purple" />
              Tenho interesse em torneios e amistosos
            </label>
          </section>

          <section className="space-y-4 border-t border-white/10 pt-6">
            <div>
              <h2 className="font-bold text-white">Sua autoavaliação</h2>
              <p className="mt-1 text-xs text-white/45">Dê uma nota de 0 a 5 para ajudar na formação de times equilibrados.</p>
            </div>
            {SKILL_CATEGORIES.map((category) => (
              <SkillSlider key={category} name={category} label={SKILL_LABELS[category]} defaultValue={selfRatings[category] ?? 2.5} />
            ))}
          </section>

          <button type="submit" className="w-full rounded-xl bg-brand-purple px-4 py-3.5 font-bold text-white shadow-lg shadow-purple-950/25 transition hover:bg-brand-purple-dark">
            {completingApprovedProfile ? "Salvar e continuar" : "Entrar no VPA"}
          </button>
        </form>
      </div>
    </div>
  );
}

const inputClass = "mt-1 w-full rounded-lg border border-white/15 bg-white/[0.03] px-3 py-2.5 text-white focus:border-brand-purple focus:outline-none focus:ring-1 focus:ring-brand-purple";

function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return <label className={`block text-sm font-medium text-white ${className}`}>{label}{children}</label>;
}

function Radio({ name, value, label, defaultChecked = false }: { name: string; value: string; label: string; defaultChecked?: boolean }) {
  return <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2 text-sm text-white"><input type="radio" name={name} value={value} required defaultChecked={defaultChecked} className="h-4 w-4 border-white/15 text-purple-300 focus:ring-brand-purple" />{label}</label>;
}
