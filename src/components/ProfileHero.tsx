import type { ReactNode } from "react";
import { Plus } from "lucide-react";
import { Avatar } from "./Avatar";
import { BadgeIcon } from "./BadgeIcon";
import { NicknameBadge } from "./NicknameBadge";
import { ProfileBannerArt } from "./ProfileBannerArt";
import { ProfileEffect } from "./ProfileEffect";
import { isBannerId, isEffectId } from "@/lib/cosmetics";
import type { Badge } from "@/lib/badges";

/**
 * Cartão de perfil: capa (banner), foto com moldura, nome, medalhas em
 * destaque e o efeito animado por cima de tudo. Serve tanto pro "Meu perfil"
 * quanto pro perfil de outros jogadores e pra prévia da personalização.
 */
export function ProfileHero({
  fullName,
  avatarUrl,
  avatarFrame,
  banner,
  effect,
  nickname,
  isSetter,
  badges,
  showEmptyBadgeSlots = false,
  eyebrow,
  children,
}: {
  fullName: string;
  avatarUrl: string | null;
  avatarFrame?: string | null;
  banner?: string | null;
  effect?: string | null;
  nickname?: string | null;
  isSetter?: boolean;
  /** Até 3 medalhas em destaque. */
  badges?: Badge[];
  /** No perfil próprio, mostra "+" nas vagas livres pra convidar a escolher. */
  showEmptyBadgeSlots?: boolean;
  eyebrow?: string;
  children?: ReactNode;
}) {
  const bannerId = isBannerId(banner) ? banner : "vpa";
  const effectId = isEffectId(effect) ? effect : null;
  const shown = (badges ?? []).slice(0, 3);
  const empty = showEmptyBadgeSlots ? Math.max(0, 3 - shown.length) : 0;

  return (
    <section className="relative isolate overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-b from-[#2a1760] to-[#120a2e] shadow-xl shadow-purple-950/30">
      <div className="relative h-28 sm:h-36">
        <ProfileBannerArt id={bannerId} />
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-[#2a1760]/90 to-transparent" />
        {eyebrow && (
          <span className="absolute left-4 top-3 rounded-full bg-black/35 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white/85">
            {eyebrow}
          </span>
        )}
      </div>

      <div className="relative px-5 pb-5">
        <div className="-mt-11 flex items-end justify-between gap-3">
          <div className="relative z-[5] rounded-full bg-[#241352] p-1 shadow-lg shadow-black/40">
            <Avatar src={avatarUrl} name={fullName} size="xl" frame={avatarFrame} ring="ring-purple-200/40" />
          </div>
          {(shown.length > 0 || empty > 0) && (
            <div className="relative z-[5] flex items-center gap-1.5 pb-1">
              {shown.map((badge) => <BadgeIcon key={badge.id} badge={badge} size="md" />)}
              {Array.from({ length: empty }, (_, i) => (
                <span key={i} className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-dashed border-white/20 text-white/30">
                  <Plus className="h-4 w-4" aria-hidden />
                </span>
              ))}
            </div>
          )}
        </div>

        <h2 className="mt-3 truncate text-2xl font-black leading-tight text-white">{fullName}</h2>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <NicknameBadge text={nickname ?? null} />
          {isSetter ? (
            <span className="rounded-full border border-sky-300/20 bg-sky-300/10 px-2 py-0.5 text-[10px] font-bold text-sky-200">🏐 Levantador(a)</span>
          ) : null}
        </div>
        {children}
      </div>

      {effectId && <ProfileEffect id={effectId} />}
    </section>
  );
}
