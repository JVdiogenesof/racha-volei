"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { SkillSlider } from "@/components/SkillSlider";
import { ActionForm } from "@/components/ActionForm";
import { RemoveMemberButton } from "@/components/RemoveMemberButton";
import { NicknameBadge } from "@/components/NicknameBadge";
import { Avatar } from "@/components/Avatar";
import { SKILL_CATEGORIES, SKILL_LABELS, type RatingsByCategory } from "@/lib/scoring";
import { setOrganizerRatings, updatePlayerProfile, removeMember } from "@/app/(app)/admin/jogadores/actions";

export function PlayerRatingEditor({
  profileId,
  fullName,
  avatarUrl,
  nicknameBadge,
  communities,
  overall,
  organizerRatings,
}: {
  profileId: string;
  fullName: string;
  avatarUrl: string | null;
  nicknameBadge: string | null;
  communities: ("court" | "sand")[];
  overall: number;
  organizerRatings: RatingsByCategory;
}) {
  const [open, setOpen] = useState(false);
  const communityValue = communities.includes("court") && communities.includes("sand")
    ? "both"
    : communities.includes("sand")
      ? "sand"
      : "court";
  const communityLabel = communityValue === "both" ? "Quadra e areia" : communityValue === "sand" ? "Areia" : "Quadra";

  return (
    <div className="rounded-lg border border-white/10">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full min-w-0 cursor-pointer flex-wrap items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-white/5"
      >
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2 font-medium text-white">
          <Avatar src={avatarUrl} name={fullName} size="sm" />
          <span className="min-w-0 flex-1 break-words">{fullName}</span>
          <NicknameBadge text={nicknameBadge} />
          <span className="rounded-full border border-cyan-300/15 bg-cyan-300/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-cyan-100">{communityLabel}</span>
        </span>
        <span className="flex w-full items-center justify-end gap-2 text-sm text-white/60 sm:w-auto">
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
          <div>
            <label className="block text-xs font-medium text-white/60">Modalidade do jogador</label>
            <select
              name="playCommunity"
              defaultValue={communityValue}
              required
              className="mt-1 min-h-11 w-full rounded-lg border border-white/15 bg-[#21123d] px-3 py-2 text-sm text-white"
            >
              <option value="court">Quadra</option>
              <option value="sand">Areia</option>
              <option value="both">Quadra e areia</option>
            </select>
            <p className="mt-1 text-xs text-white/40">Pedidos e históricos anteriores continuam na modalidade em que foram registrados.</p>
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
