"use client";

import { useState } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { ActionForm } from "@/components/ActionForm";
import { SkillSlider } from "@/components/SkillSlider";
import { SKILL_CATEGORIES, SKILL_LABELS, type RatingsByCategory } from "@/lib/scoring";
import { setOrganizerRatings } from "@/app/(app)/admin/jogadores/actions";

export function GuestRatingEditor({
  eventId,
  profileId,
  fullName,
  initialRatings,
  provisional,
}: {
  eventId: string;
  profileId: string;
  fullName: string;
  initialRatings: RatingsByCategory;
  provisional: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-amber-300/15 bg-amber-400/[0.045]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-amber-100 transition hover:bg-amber-400/10"
      >
        <SlidersHorizontal className="h-4 w-4 shrink-0 text-amber-300" strokeWidth={2} />
        <span className="min-w-0 flex-1">{provisional ? "Avaliar convidado" : "Reavaliar convidado"}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-amber-200/60 transition-transform ${open ? "rotate-180" : ""}`} strokeWidth={2} />
      </button>

      {open && (
        <ActionForm
          action={setOrganizerRatings}
          successMessage={`Avaliação de ${fullName} salva!`}
          className="space-y-4 border-t border-amber-300/15 px-3 py-4"
        >
          <input type="hidden" name="profileId" value={profileId} />
          <input type="hidden" name="eventId" value={eventId} />
          <p className="text-xs leading-relaxed text-white/50">
            Essa avaliação será usada na formação dos times e continuará no perfil se a pessoa virar membro oficial.
          </p>
          {SKILL_CATEGORIES.map((category) => (
            <SkillSlider
              key={category}
              inputId={`${profileId}-${category}`}
              name={category}
              label={SKILL_LABELS[category]}
              defaultValue={initialRatings[category] ?? 2.5}
            />
          ))}
          <button
            type="submit"
            className="min-h-11 w-full rounded-lg bg-brand-purple px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-purple-dark"
          >
            Salvar avaliação
          </button>
        </ActionForm>
      )}
    </div>
  );
}
