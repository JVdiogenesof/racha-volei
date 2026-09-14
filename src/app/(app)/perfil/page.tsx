import { CalendarCheck, Trophy, Crown } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { getPlayerRatings, getRatingWeights } from "@/lib/ratings";
import { getRankingCounts } from "@/lib/rankings";
import { getAttendanceStreaks } from "@/lib/streak";
import { SKILL_CATEGORIES, SKILL_LABELS, finalScoresForPlayer, overallScore } from "@/lib/scoring";
import { SkillSlider } from "@/components/SkillSlider";
import { ScoreBar } from "@/components/ScoreBar";
import { ActionForm } from "@/components/ActionForm";
import { Avatar } from "@/components/Avatar";
import { PushOptIn } from "@/components/PushOptIn";
import { NicknameBadge } from "@/components/NicknameBadge";
import { ATTENDANCE_FREQUENCY_OPTIONS } from "@/lib/attendanceFrequency";
import { updateProfileData, updateSelfRatings } from "./actions";

export default async function PerfilPage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const [{ self, organizer }, weights, rankingCounts, streaks] = await Promise.all([
    getPlayerRatings(supabase, profile.id),
    getRatingWeights(supabase),
    getRankingCounts(supabase),
    getAttendanceStreaks(supabase),
  ]);

  const finalScores = finalScoresForPlayer(self, organizer, weights.selfWeight, weights.organizerWeight);
  const overall = overallScore(finalScores);

  const myStats = [
    { label: "Presenças", value: rankingCounts.attendance.get(profile.id) ?? 0, icon: CalendarCheck },
    { label: "Vezes destaque", value: rankingCounts.mvp.get(profile.id) ?? 0, icon: Trophy },
    { label: "Vitórias", value: rankingCounts.wins.get(profile.id) ?? 0, icon: Crown },
  ];

  return (
    <div className="space-y-10">
      <div className="flex items-center gap-4">
        <Avatar src={profile.avatar_url} name={profile.full_name} size="lg" streak={streaks.get(profile.id)} />
        <div>
          <h1 className="text-2xl font-bold text-white">Meu perfil</h1>
          <p className="text-sm text-white/60">
            Sua nota final combina sua autoavaliação com a nota dos organizadores.
          </p>
          <NicknameBadge text={profile.nickname_badge} className="mt-1.5" />
        </div>
      </div>

      <section>
        <h2 className="font-semibold text-white">Meu histórico</h2>
        <div className="mt-3 grid grid-cols-3 gap-3">
          {myStats.map((s) => (
            <div key={s.label} className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
              <s.icon className="mx-auto h-5 w-5 text-purple-300" strokeWidth={2} />
              <p className="mt-2 text-xl font-bold text-white">{s.value}</p>
              <p className="text-xs text-white/60">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-white/10 p-6">
        <h2 className="font-semibold text-white">Notificações</h2>
        <p className="mt-1 text-sm text-white/60">
          Receba avisos direto no celular (racha novo, lista publicada, times prontos, etc.).
        </p>
        <div className="mt-4">
          <PushOptIn />
        </div>
      </section>

      <section className="rounded-xl border border-white/10 p-6">
        <h2 className="font-semibold text-white">Nota final</h2>
        <p className="mt-1 text-sm text-white/60">Geral: {overall.toFixed(1)} / 5</p>
        <div className="mt-4 space-y-3">
          {SKILL_CATEGORIES.map((c) => (
            <ScoreBar key={c} label={SKILL_LABELS[c]} value={finalScores[c]} />
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-white/10 p-6">
        <h2 className="font-semibold text-white">Dados pessoais</h2>
        <ActionForm action={updateProfileData} successMessage="Dados salvos!" className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-white">Nome completo</label>
            <input
              name="fullName"
              defaultValue={profile.full_name}
              required
              className="mt-1 w-full rounded-lg border border-white/15 px-3 py-2 focus:border-brand-purple focus:outline-none focus:ring-1 focus:ring-brand-purple"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-white">Data de aniversário</label>
            <input
              type="date"
              name="birthdate"
              defaultValue={profile.birthdate ?? ""}
              required
              className="mt-1 w-full rounded-lg border border-white/15 px-3 py-2 focus:border-brand-purple focus:outline-none focus:ring-1 focus:ring-brand-purple"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-white">Telefone</label>
            <input
              name="phone"
              defaultValue={profile.phone ?? ""}
              className="mt-1 w-full rounded-lg border border-white/15 px-3 py-2 focus:border-brand-purple focus:outline-none focus:ring-1 focus:ring-brand-purple"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-white">
              Insígnia <span className="text-white/40">(apelido divertido, opcional)</span>
            </label>
            <input
              name="nicknameBadge"
              defaultValue={profile.nickname_badge ?? ""}
              maxLength={40}
              placeholder="ex: só tenho ataque 🔥"
              className="mt-1 w-full rounded-lg border border-white/15 px-3 py-2 focus:border-brand-purple focus:outline-none focus:ring-1 focus:ring-brand-purple"
            />
            <p className="mt-1 text-xs text-white/40">Aparece do lado do seu nome na lista de jogadores.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-white">Posição que joga</label>
            <div className="mt-2 flex gap-4 text-sm text-white">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="position"
                  value="attacker"
                  defaultChecked={!profile.is_setter}
                  className="h-4 w-4 border-white/15 text-purple-300 focus:ring-brand-purple"
                />
                Atacando
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="position"
                  value="setter"
                  defaultChecked={profile.is_setter}
                  className="h-4 w-4 border-white/15 text-purple-300 focus:ring-brand-purple"
                />
                Levantando
              </label>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-white">Pretende ir quantas vezes?</label>
            <select
              name="attendanceFrequency"
              defaultValue={profile.attendance_frequency ?? "weekly"}
              className="mt-1 w-full rounded-lg border border-white/15 px-3 py-2 focus:border-brand-purple focus:outline-none focus:ring-1 focus:ring-brand-purple"
            >
              {ATTENDANCE_FREQUENCY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm text-white">
            <input
              type="checkbox"
              name="hasVpaShirt"
              defaultChecked={profile.has_vpa_shirt}
              className="h-4 w-4 rounded border-white/15 text-purple-300 focus:ring-brand-purple"
            />
            Já tenho a camisa do VPA
          </label>
          <label className="flex items-center gap-2 text-sm text-white">
            <input
              type="checkbox"
              name="wantsTournaments"
              defaultChecked={profile.wants_tournaments}
              className="h-4 w-4 rounded border-white/15 text-purple-300 focus:ring-brand-purple"
            />
            Pretendo participar de torneios e amistosos
          </label>
          <button
            type="submit"
            className="rounded-lg bg-brand-purple px-4 py-2 font-medium text-white hover:bg-brand-purple-dark"
          >
            Salvar dados
          </button>
        </ActionForm>
      </section>

      <section className="rounded-xl border border-white/10 p-6">
        <h2 className="font-semibold text-white">Minha autoavaliação</h2>
        <p className="mt-1 text-sm text-white/60">
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
