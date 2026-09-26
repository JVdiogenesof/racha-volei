import { requireProfile } from "@/lib/auth";
import { ActionForm } from "@/components/ActionForm";
import { ATTENDANCE_FREQUENCY_OPTIONS } from "@/lib/attendanceFrequency";
import { updateProfileData } from "../actions";

export default async function PerfilDadosPage() {
  const profile = await requireProfile();

  return (
    <div>
      <h1 className="text-2xl font-bold text-white">Dados pessoais</h1>
      <p className="mt-1 text-sm text-white/60">Seus dados de contato e preferências pro racha.</p>

      <ActionForm action={updateProfileData} successMessage="Dados salvos!" className="mt-6 space-y-4 rounded-xl border border-white/10 p-6">
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
          <label className="block text-sm font-medium text-white">Nível</label>
          <select
            name="playerLevel"
            defaultValue={profile.player_level ?? "intermediate"}
            required
            className="mt-1 w-full rounded-lg border border-white/15 px-3 py-2 focus:border-brand-purple focus:outline-none focus:ring-1 focus:ring-brand-purple"
          >
            <option value="beginner">Iniciante</option>
            <option value="intermediate">Intermediário</option>
            <option value="advanced">Avançado</option>
          </select>
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
    </div>
  );
}
