import Link from "next/link";
import { ArrowRight, Frame, ImageIcon, Sparkles } from "lucide-react";
import { AvatarUploader } from "./AvatarUploader";
import { ProfileHero } from "./ProfileHero";
import { AVATAR_FRAMES } from "@/lib/avatarFrames";
import { cosmeticName } from "@/lib/cosmetics";
import type { Badge } from "@/lib/badges";

/** Aba "Personalizar" do perfil: foto, prévia do cartão e a porta de entrada do editor de visual. */
export function PersonalizarHub({
  fullName,
  avatarUrl,
  nickname,
  isSetter,
  frame,
  banner,
  effect,
  featuredBadges,
}: {
  fullName: string;
  avatarUrl: string | null;
  nickname: string | null;
  isSetter: boolean;
  frame: string | null;
  banner: string | null;
  effect: string | null;
  featuredBadges: Badge[];
}) {
  const items = [
    { icon: Frame, label: "Moldura", value: frame ? cosmeticName("frame", frame, AVATAR_FRAMES) : "Nenhuma" },
    { icon: ImageIcon, label: "Banner", value: banner ? cosmeticName("banner", banner, AVATAR_FRAMES) : "Padrão" },
    { icon: Sparkles, label: "Efeito", value: effect ? cosmeticName("effect", effect, AVATAR_FRAMES) : "Nenhum" },
  ];

  return (
    <div className="space-y-5">
      <AvatarUploader fullName={fullName} avatarUrl={avatarUrl} frame={frame} />

      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-white/50">Seu cartão agora</p>
        <ProfileHero fullName={fullName} avatarUrl={avatarUrl} avatarFrame={frame} banner={banner} effect={effect} nickname={nickname} isSetter={isSetter} badges={featuredBadges} showEmptyBadgeSlots />
      </div>

      <Link
        href="/perfil/personalizar"
        className="group block rounded-3xl border border-fuchsia-300/40 bg-gradient-to-br from-fuchsia-500/25 via-purple-500/20 to-amber-400/15 p-4 shadow-lg shadow-purple-950/40 transition hover:border-fuchsia-200/70"
      >
        <p className="text-base font-extrabold text-white">Editor de visual</p>
        <p className="mt-0.5 text-xs text-white/65">Moldura animada, banner e efeito do cartão.</p>
        <ul className="mt-3 grid grid-cols-3 gap-2">
          {items.map((item) => (
            <li key={item.label} className="rounded-2xl bg-black/25 p-2 text-center">
              <item.icon className="mx-auto h-4 w-4 text-amber-300" aria-hidden />
              <p className="mt-1 text-[9px] font-bold uppercase tracking-wide text-white/45">{item.label}</p>
              <p className="truncate text-[11px] font-bold text-white">{item.value}</p>
            </li>
          ))}
        </ul>
        <span className="mt-3 flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-white text-sm font-black text-[#3b1975] transition group-hover:bg-purple-50">
          Abrir editor <ArrowRight className="h-4 w-4" aria-hidden />
        </span>
      </Link>
    </div>
  );
}
