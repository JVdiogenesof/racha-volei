"use client";

import { useState } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { SkillSlider } from "@/components/SkillSlider";
import { ActionForm } from "@/components/ActionForm";
import { RemoveMemberButton } from "@/components/RemoveMemberButton";
import { NicknameBadge } from "@/components/NicknameBadge";
import { SKILL_CATEGORIES, SKILL_LABELS, type RatingsByCategory } from "@/lib/scoring";
import { setOrganizerRatings, updatePlayerProfile, removeMember } from "@/app/(app)/admin/jogadores/actions";

export function PlayerRatingEditor({
  profileId,
  fullName,
  nicknameBadge,
  overall,
  organizerRatings,
}: {
  profileId: string;
  fullName: string;
  nicknameBadge: string | null;
  overall: number;
  organizerRatings: RatingsByCategory;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-white/10">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-white/5"
      >
        <span className="flex items-center gap-2 font-medium text-white">
          <SlidersHorizontal className="h-4 w-4 shrink-0 text-purple-300" strokeWidth={2} />
          {fullName}
          <NicknameBadge text={nicknameBadge} />
        </span>
        <span className="flex items-center gap-2 text-sm text-white/60">
          nota geral: <span className="font-semibold text-purple-300">{overall.toFixed(1)}</span>
          <ChevronDown
            className={`h-4 w-4 text-white/40 transition-transform ${open ? "rotate-180" : ""}`}
            strokeWidth={2}
          />
        </span>
      </button>
      {open && (
        <ActionForm
          action={updatePlayerProfile}
          successMessage={`Perfil de ${fullName} atualizado!`}
          className="space-y-3 border-t border-white/10 px-4 py-4"
        >
          <input type="hidden" name="profileId" value={profileId} />
          <div>
            <label className="block text-xs font-medium text-white/60">Nome completo</label>
            <input
              name="fullName"
              defaultValue={fullName}
              required
              className="mt-1 w-full rounded-lg border border-white/15 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-white/60">Insígnia (apelido divertido)</label>
            <input
              name="nicknameBadge"
              defaultValue={nicknameBadge ?? ""}
              maxLength={40}
              placeholder="ex: só tenho ataque 🔥"
              className="mt-1 w-full rounded-lg border border-white/15 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white hover:bg-white/10"
          >
            Salvar perfil
          </button>
        </ActionForm>
      )}
      {open && (
        <ActionForm
          action={setOrganizerRatings}
          successMessage={`Nota de ${fullName} salva!`}
          className="space-y-4 border-t border-white/10 px-4 py-4"
        >
          <input type="hidden" name="profileId" value={profileId} />
          {SKILL_CATEGORIES.map((c) => (
            <SkillSlider
              key={c}
              name={c}
              label={SKILL_LABELS[c]}
              defaultValue={organizerRatings[c] ?? 2.5}
            />
          ))}
          <button
            type="submit"
            className="rounded-lg bg-brand-purple px-4 py-2 text-sm font-medium text-white hover:bg-brand-purple-dark"
          >
            Salvar nota do organizador
          </button>
        </ActionForm>
      )}
      {open && (
        <div className="flex justify-end border-t border-white/10 px-4 py-3">
          <RemoveMemberButton profileId={profileId} fullName={fullName} action={removeMember} />
        </div>
      )}
    </div>
  );
}
