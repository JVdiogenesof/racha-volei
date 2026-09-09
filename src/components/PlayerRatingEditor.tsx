"use client";

import { useState } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { SkillSlider } from "@/components/SkillSlider";
import { ActionForm } from "@/components/ActionForm";
import { SKILL_CATEGORIES, SKILL_LABELS, type RatingsByCategory } from "@/lib/scoring";
import { setOrganizerRatings } from "@/app/(app)/admin/jogadores/actions";

export function PlayerRatingEditor({
  profileId,
  fullName,
  overall,
  organizerRatings,
}: {
  profileId: string;
  fullName: string;
  overall: number;
  organizerRatings: RatingsByCategory;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-gray-200">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-gray-50"
      >
        <span className="flex items-center gap-2 font-medium text-brand-navy">
          <SlidersHorizontal className="h-4 w-4 shrink-0 text-brand-purple" strokeWidth={2} />
          {fullName}
        </span>
        <span className="flex items-center gap-2 text-sm text-gray-500">
          nota geral: <span className="font-semibold text-brand-purple">{overall.toFixed(1)}</span>
          <ChevronDown
            className={`h-4 w-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
            strokeWidth={2}
          />
        </span>
      </button>
      {open && (
        <ActionForm
          action={setOrganizerRatings}
          successMessage={`Nota de ${fullName} salva!`}
          className="space-y-4 border-t border-gray-100 px-4 py-4"
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
    </div>
  );
}
